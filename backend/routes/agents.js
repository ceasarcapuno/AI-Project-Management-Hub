// ─── Agents Router ────────────────────────────────────────────────────────────
// Mounted at: /api/agents
// POST /:id/run — ad-hoc agent execution with local file output.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const pool    = require('../db');
const { requireAuth }          = require('../middleware/auth');
const { runSubAgent }          = require('../services/anthropic');
const redis                    = require('../services/redis');
const { createTokenBudgetGuard } = require('../middleware/tokenBudget');
const { addTokenUsage }          = require('../services/tokenTracker');
const { sanitizeFilename, validateUploadPath, checkUserQuota } = require('../services/fileManager');

const router = express.Router();
router.use(requireAuth);

// ─── Token budget resolver for agent runs ────────────────────────────────────
// Resolves the project that owns this agent so the budget guard can check it.
const agentBudgetGuard = createTokenBudgetGuard(async (req) => {
  const { rows } = await pool.query(
    `SELECT a.project_id, w.user_id
     FROM agents a
     JOIN projects p  ON p.id = a.project_id
     JOIN workspaces w ON w.id = p.workspace_id
     WHERE a.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) throw new Error(`Agent ${req.params.id} not found`);
  return { projectId: rows[0].project_id, userId: rows[0].user_id };
});

const UPLOADS_ROOT = process.env.UPLOADS_PATH || '/app/uploads';

// Helper: verify project access
async function getProjectForUser(projectId, userId) {
  const { rows } = await pool.query(
    `SELECT p.* FROM projects p JOIN workspaces w ON w.id = p.workspace_id
     WHERE p.id = $1 AND w.user_id = $2`,
    [projectId, userId]
  );
  return rows[0] ?? null;
}

// GET /api/agents?project_id=
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    const project = await getProjectForUser(project_id, req.user.id);
    if (!project) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await pool.query(
      'SELECT * FROM agents WHERE project_id = $1 ORDER BY created_at DESC',
      [project_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[GET /agents]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/agents
router.post('/', async (req, res) => {
  try {
    const { project_id, name, emoji, model, status = 'waiting' } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Agent name is required' });

    const project = await getProjectForUser(project_id, req.user.id);
    if (!project) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await pool.query(
      `INSERT INTO agents (project_id, name, emoji, model, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [project_id, name.trim(), emoji ?? null, model ?? null, status]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /agents]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/agents/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, emoji, model, status } = req.body;

    const sets = [];
    const vals = [];
    let   idx  = 1;

    if (name   !== undefined) { sets.push(`name = $${idx++}`);   vals.push(name.trim()); }
    if (emoji  !== undefined) { sets.push(`emoji = $${idx++}`);  vals.push(emoji); }
    if (model  !== undefined) { sets.push(`model = $${idx++}`);  vals.push(model); }
    if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields provided for update' });

    vals.push(id, req.user.id);
    const { rows } = await pool.query(
      `UPDATE agents a SET ${sets.join(', ')}
       FROM projects p JOIN workspaces w ON w.id = p.workspace_id
       WHERE a.id = $${idx++} AND a.project_id = p.id AND w.user_id = $${idx}
       RETURNING a.*`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Agent not found or access denied' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /agents/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/agents/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM agents a
       USING projects p JOIN workspaces w ON w.id = p.workspace_id
       WHERE a.id = $1 AND a.project_id = p.id AND w.user_id = $2`,
      [req.params.id, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /agents/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/:id/run
router.post('/:id/run', agentBudgetGuard, async (req, res) => {
  const userId = req.user.id;
  const { id: agentId } = req.params;

  try {
    const { task_description, output_filename } = req.body;
    if (!task_description || task_description.trim() === '') {
      return res.status(400).json({ error: 'task_description is required' });
    }

    // Load agent + project
    const { rows: agentRows } = await pool.query(
      `SELECT a.*, p.name AS project_name, p.goal AS project_goal, p.id AS project_id
       FROM agents a
       JOIN projects p ON p.id = a.project_id
       JOIN workspaces w ON w.id = p.workspace_id
       WHERE a.id = $1 AND w.user_id = $2`,
      [agentId, userId]
    );
    if (!agentRows[0]) return res.status(404).json({ error: 'Agent not found' });
    const agent = agentRows[0];

    // Update status to active
    await pool.query('UPDATE agents SET status = $1 WHERE id = $2', ['active', agentId]);

    const { rows: milestones } = await pool.query(
      'SELECT name, status FROM milestones WHERE project_id = $1 ORDER BY position ASC',
      [agent.project_id]
    );

    const projectContext = {
      projectName: agent.project_name,
      projectGoal: agent.project_goal,
      milestones,
      agentName: agent.name,
    };

    const rawFilename = output_filename || `${(agent.name || 'agent').toLowerCase().replace(/\s+/g,'-')}-${Date.now()}.md`;
    const filename    = sanitizeFilename(rawFilename);

    // Early quota gate (just checks the user has space at all)
    await checkUserQuota(userId, 0);

    const agentResult = await runSubAgent(agent.name, task_description.trim(), projectContext, filename);

    // Definitive quota check after we know the actual file size
    const sizeKb = Math.ceil(Buffer.byteLength(agentResult.fileContent, 'utf8') / 1024);
    await checkUserQuota(userId, sizeKb);

    // Save to disk
    const outputDir   = path.join(UPLOADS_ROOT, userId, agent.project_id);
    fs.mkdirSync(outputDir, { recursive: true });
    const rawFilepath = path.join(outputDir, filename);
    const filepath    = validateUploadPath(rawFilepath);
    fs.writeFileSync(filepath, agentResult.fileContent, 'utf8');

    // Output record (no task_id for ad-hoc agent runs)
    const { rows: outRows } = await pool.query(
      `INSERT INTO outputs (agent, filename, filepath, size_kb, user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [agent.name, filename, filepath, sizeKb, userId]
    );
    const outputRecord = outRows[0];

    // Thread message
    const totalTokens = agentResult.inputTokens + agentResult.outputTokens;
    const { rows: msgRows } = await pool.query(
      `INSERT INTO thread_messages (project_id, from_type, name, type, label, text, deliverables)
       VALUES ($1, 'agent', $2, 'report', $3, $4, $5) RETURNING *`,
      [
        agent.project_id,
        agent.name,
        agentResult.label,
        agentResult.content.slice(0, 1000),
        JSON.stringify([{ label: filename, status: 'completed', output_id: outputRecord.id }]),
      ]
    );

    // Update agent metrics
    await pool.query(
      `UPDATE agents SET status = 'idle', tasks_done = tasks_done + 1, cost = cost + $1 WHERE id = $2`,
      [agentResult.cost, agentId]
    );

    // Update project totals + append agent_run audit row
    await addTokenUsage(agent.project_id, agentId, {
      inputTokens:  agentResult.inputTokens,
      outputTokens: agentResult.outputTokens,
      model:        agent.model || 'claude-sonnet-4-6',
    });

    // Notification + Redis publish
    const { rows: notifRows } = await pool.query(
      `INSERT INTO notifications (user_id, type, level, title, summary, project, agent, token_used)
       VALUES ($1, 'agent', 'success', $2, $3, $4, $5, $6) RETURNING *`,
      [userId, `${agent.name} Completed Task`, `Agent finished and generated ${filename}.`, agent.project_id, agent.name, totalTokens]
    );
    try { await redis.publish(`notifications:${userId}`, JSON.stringify(notifRows[0])); } catch (_) {}

    return res.json({ threadMessage: msgRows[0], output: outputRecord, tokensUsed: totalTokens, cost: agentResult.cost });
  } catch (err) {
    console.error('[POST /agents/:id/run]', err.message);
    await pool.query('UPDATE agents SET status = $1 WHERE id = $2', ['error', agentId]).catch(() => {});
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
