// ─── Tasks Router ─────────────────────────────────────────────────────────────
// Mounted at: /api/tasks
// POST /:id/run triggers AI agent execution and saves output to local filesystem.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const pool    = require('../db');
const { requireAuth }            = require('../middleware/auth');
const { runSubAgent }            = require('../services/anthropic');
const redis                      = require('../services/redis');
const { createTokenBudgetGuard } = require('../middleware/tokenBudget');
const { addTokenUsage }          = require('../services/tokenTracker');
const { sanitizeFilename, validateUploadPath, checkUserQuota } = require('../services/fileManager');

const router = express.Router();
router.use(requireAuth);

// ─── Token budget resolver for task runs ─────────────────────────────────────
// Walks task → milestone → project to find the owning project + user.
const taskBudgetGuard = createTokenBudgetGuard(async (req) => {
  const { rows } = await pool.query(
    `SELECT m.project_id, w.user_id
     FROM tasks t
     JOIN milestones m  ON m.id = t.milestone_id
     JOIN projects p    ON p.id = m.project_id
     JOIN workspaces w  ON w.id = p.workspace_id
     WHERE t.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new Error(`Task ${req.params.id} not found`);
  return { projectId: rows[0].project_id, userId: rows[0].user_id };
});

const UPLOADS_ROOT = process.env.UPLOADS_PATH || '/app/uploads';

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { project_id, milestone_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    let sql  = `SELECT t.* FROM tasks t
                JOIN milestones m ON m.id = t.milestone_id
                JOIN projects p ON p.id = m.project_id
                JOIN workspaces w ON w.id = p.workspace_id
                WHERE p.id = $1 AND w.user_id = $2`;
    const vals = [project_id, req.user.id];

    if (milestone_id) {
      sql += ` AND t.milestone_id = $3`;
      vals.push(milestone_id);
    }
    sql += ' ORDER BY t.position ASC';

    const { rows } = await pool.query(sql, vals);
    return res.json(rows);
  } catch (err) {
    console.error('[GET /tasks]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { milestone_id, name, status = 'todo', agent, model, position = 0 } = req.body;
    if (!milestone_id) return res.status(400).json({ error: 'milestone_id is required' });
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Task name is required' });

    const { rows } = await pool.query(
      `INSERT INTO tasks (milestone_id, name, status, agent, model, position)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [milestone_id, name.trim(), status, agent ?? null, model ?? null, Number(position)]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /tasks]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, agent, model, position } = req.body;

    const sets = [];
    const vals = [];
    let   idx  = 1;

    if (name     !== undefined) { sets.push(`name = $${idx++}`);     vals.push(name.trim()); }
    if (status   !== undefined) { sets.push(`status = $${idx++}`);   vals.push(status); }
    if (agent    !== undefined) { sets.push(`agent = $${idx++}`);    vals.push(agent); }
    if (model    !== undefined) { sets.push(`model = $${idx++}`);    vals.push(model); }
    if (position !== undefined) { sets.push(`position = $${idx++}`); vals.push(Number(position)); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields provided for update' });

    vals.push(id, req.user.id);
    const { rows } = await pool.query(
      `UPDATE tasks t SET ${sets.join(', ')}
       FROM milestones m
       JOIN projects p  ON p.id = m.project_id
       JOIN workspaces w ON w.id = p.workspace_id
       WHERE t.id = $${idx++} AND t.milestone_id = m.id AND w.user_id = $${idx}
       RETURNING t.*`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Task not found or access denied' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /tasks/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM tasks t
       USING milestones m
       JOIN projects p   ON p.id = m.project_id
       JOIN workspaces w ON w.id = p.workspace_id
       WHERE t.id = $1 AND t.milestone_id = m.id AND w.user_id = $2`,
      [req.params.id, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /tasks/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/tasks/:id/run ──────────────────────────────────────────────────
router.post('/:id/run', taskBudgetGuard, async (req, res) => {
  const userId = req.user.id;
  const { id: taskId } = req.params;

  try {
    // Load task with project context
    const { rows: taskRows } = await pool.query(
      `SELECT t.*, m.project_id, p.name AS project_name, p.goal AS project_goal
       FROM tasks t
       JOIN milestones m  ON m.id = t.milestone_id
       JOIN projects p    ON p.id = m.project_id
       JOIN workspaces w  ON w.id = p.workspace_id
       WHERE t.id = $1 AND w.user_id = $2`,
      [taskId, userId]
    );

    if (!taskRows[0]) return res.status(404).json({ error: 'Task not found' });
    const task = taskRows[0];

    if (!task.agent) {
      return res.status(400).json({ error: 'Task has no assigned agent. Set an agent before running.' });
    }

    // Mark in-progress
    await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', ['in_progress', taskId]);

    // Load milestones for project context
    const { rows: milestones } = await pool.query(
      'SELECT name, status FROM milestones WHERE project_id = $1 ORDER BY position ASC',
      [task.project_id]
    );

    const projectContext = {
      projectName: task.project_name,
      projectGoal: task.project_goal,
      milestones,
      taskName: task.name,
    };

    const rawFilename    = `${task.agent.toLowerCase()}-${task.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}-${Date.now()}.md`;
    const outputFilename = sanitizeFilename(rawFilename);

    // Check that the user has space before invoking the model (early gate)
    await checkUserQuota(userId, 0);

    // Run the AI agent
    const agentResult = await runSubAgent(task.agent, task.name, projectContext, outputFilename);

    // Compute size and do the definitive quota check
    const sizeKb = Math.ceil(Buffer.byteLength(agentResult.fileContent, 'utf8') / 1024);
    await checkUserQuota(userId, sizeKb);

    // Save file to local filesystem
    const outputDir  = path.join(UPLOADS_ROOT, userId, task.project_id);
    fs.mkdirSync(outputDir, { recursive: true });
    const rawFilepath = path.join(outputDir, outputFilename);
    const filepath    = validateUploadPath(rawFilepath);
    fs.writeFileSync(filepath, agentResult.fileContent, 'utf8');

    // Insert output record
    const { rows: outRows } = await pool.query(
      `INSERT INTO outputs (task_id, agent, filename, filepath, size_kb, user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [taskId, task.agent, outputFilename, filepath, sizeKb, userId]
    );
    const outputRecord = outRows[0];

    // Insert thread message
    const totalTokens = agentResult.inputTokens + agentResult.outputTokens;
    const preview     = agentResult.content.slice(0, 1000);
    const { rows: msgRows } = await pool.query(
      `INSERT INTO thread_messages (project_id, from_type, name, type, label, text, deliverables)
       VALUES ($1, 'agent', $2, 'report', $3, $4, $5) RETURNING *`,
      [
        task.project_id,
        `${task.agent} Agent`,
        agentResult.label,
        preview,
        JSON.stringify([{ label: outputFilename, status: 'completed', output_id: outputRecord.id }]),
      ]
    );
    const threadMessage = msgRows[0];

    // Mark task completed
    await pool.query(
      `UPDATE tasks SET status = 'completed' WHERE id = $1`,
      [taskId]
    );

    // Update project token_used + cost, append agent_run audit row
    await addTokenUsage(task.project_id, null, {
      inputTokens:  agentResult.inputTokens,
      outputTokens: agentResult.outputTokens,
      model:        task.model || 'claude-sonnet-4-6',
      taskId,
    });

    // Create notification and publish to Redis
    const { rows: notifRows } = await pool.query(
      `INSERT INTO notifications (user_id, type, level, title, summary, project, agent, token_used)
       VALUES ($1, 'task', 'success', $2, $3, $4, $5, $6) RETURNING *`,
      [
        userId,
        `Task Completed: ${task.name}`,
        `${task.agent} Agent completed "${task.name}" and generated ${outputFilename}.`,
        task.project_id,
        task.agent,
        totalTokens,
      ]
    );

    // Publish to Redis SSE channel
    try {
      await redis.publish(`notifications:${userId}`, JSON.stringify(notifRows[0]));
    } catch (redisErr) {
      console.warn('[tasks/run] Redis publish failed (non-fatal):', redisErr.message);
    }

    return res.json({ threadMessage, output: outputRecord, tokensUsed: totalTokens, cost: agentResult.cost });
  } catch (err) {
    console.error('[POST /tasks/:id/run]', err.message);
    await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', ['failed', taskId]).catch(() => {});
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
