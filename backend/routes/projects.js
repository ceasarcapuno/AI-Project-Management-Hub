// ─── Projects Router ──────────────────────────────────────────────────────────
// Mounted at: /api/projects
// All queries filter by user_id via workspace ownership.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const pool    = require('../db');
const { requireAuth }      = require('../middleware/auth');
const { getProjectTokenUsage, getRemainingBudget, estimateCallCost } = require('../services/tokenTracker');

const router = express.Router();
router.use(requireAuth);

// ─── GET /api/projects ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { workspace_id } = req.query;

    let sql  = `SELECT p.* FROM projects p
                JOIN workspaces w ON w.id = p.workspace_id
                WHERE w.user_id = $1`;
    const vals = [req.user.id];

    if (workspace_id) {
      sql += ` AND p.workspace_id = $2`;
      vals.push(workspace_id);
    }
    sql += ' ORDER BY p.created_at DESC';

    const { rows } = await pool.query(sql, vals);
    return res.json(rows);
  } catch (err) {
    console.error('[GET /projects]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/projects ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { workspace_id, name, goal, emoji, due_label, employer_note } = req.body;

    if (!workspace_id) return res.status(400).json({ error: 'workspace_id is required' });
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Project name is required' });

    // Verify workspace belongs to user
    const { rows: ws } = await pool.query(
      'SELECT id FROM workspaces WHERE id = $1 AND user_id = $2',
      [workspace_id, req.user.id]
    );
    if (!ws[0]) return res.status(403).json({ error: 'Workspace not found or access denied' });

    const { rows } = await pool.query(
      `INSERT INTO projects (workspace_id, name, goal, emoji, due_label, employer_note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [workspace_id, name.trim(), goal ?? null, emoji ?? null, due_label ?? null, employer_note ?? null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /projects]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/projects/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Load project (scoped via workspace → user)
    const { rows: pRows } = await pool.query(
      `SELECT p.* FROM projects p
       JOIN workspaces w ON w.id = p.workspace_id
       WHERE p.id = $1 AND w.user_id = $2`,
      [id, req.user.id]
    );
    if (!pRows[0]) return res.status(404).json({ error: 'Project not found' });
    const project = pRows[0];

    // Fetch related data in parallel
    const [milestones, tasks, agents, outputs, messages] = await Promise.all([
      pool.query('SELECT * FROM milestones WHERE project_id = $1 ORDER BY position ASC', [id]),
      pool.query('SELECT * FROM tasks WHERE milestone_id IN (SELECT id FROM milestones WHERE project_id = $1) ORDER BY position ASC', [id]),
      pool.query('SELECT * FROM agents WHERE project_id = $1 ORDER BY created_at DESC', [id]),
      pool.query('SELECT * FROM outputs WHERE task_id IN (SELECT id FROM tasks WHERE milestone_id IN (SELECT id FROM milestones WHERE project_id = $1)) ORDER BY created_at DESC LIMIT 20', [id]),
      pool.query('SELECT * FROM thread_messages WHERE project_id = $1 ORDER BY created_at ASC LIMIT 50', [id]),
    ]);

    return res.json({
      ...project,
      milestones:      milestones.rows,
      tasks:           tasks.rows,
      agents:          agents.rows,
      outputs:         outputs.rows,
      thread_messages: messages.rows,
    });
  } catch (err) {
    console.error('[GET /projects/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/projects/:id ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, goal, emoji, due_label, employer_note, needs_you, token_limit } = req.body;

    const sets = [];
    const vals = [];
    let   idx  = 1;

    if (name          !== undefined) { sets.push(`name = $${idx++}`);          vals.push(name.trim()); }
    if (goal          !== undefined) { sets.push(`goal = $${idx++}`);          vals.push(goal); }
    if (emoji         !== undefined) { sets.push(`emoji = $${idx++}`);         vals.push(emoji); }
    if (due_label     !== undefined) { sets.push(`due_label = $${idx++}`);     vals.push(due_label); }
    if (employer_note !== undefined) { sets.push(`employer_note = $${idx++}`); vals.push(employer_note); }
    if (needs_you     !== undefined) { sets.push(`needs_you = $${idx++}`);     vals.push(JSON.stringify(needs_you)); }
    if (token_limit   !== undefined) { sets.push(`token_limit = $${idx++}`);   vals.push(Number(token_limit)); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields provided for update' });

    vals.push(id, req.user.id);
    const { rows } = await pool.query(
      `UPDATE projects p SET ${sets.join(', ')}
       FROM workspaces w
       WHERE p.id = $${idx++} AND p.workspace_id = w.id AND w.user_id = $${idx}
       RETURNING p.*`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Project not found or access denied' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /projects/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/projects/:id/token-usage ───────────────────────────────────────
router.get('/:id/token-usage', async (req, res) => {
  try {
    // Verify project belongs to user
    const { rows: pRows } = await pool.query(
      `SELECT p.id FROM projects p
       JOIN workspaces w ON w.id = p.workspace_id
       WHERE p.id = $1 AND w.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!pRows[0]) return res.status(404).json({ error: 'Project not found' });

    const usage = await getProjectTokenUsage(req.params.id);

    // Include per-run history (last 50)
    const { rows: runs } = await pool.query(
      `SELECT id, agent_id, task_id, tokens_total, cost, model, budget_enforced, created_at
       FROM agent_runs WHERE project_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );

    return res.json({ ...usage, runs });
  } catch (err) {
    console.error('[GET /projects/:id/token-usage]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/projects/:id/budget-status ─────────────────────────────────────
router.get('/:id/budget-status', async (req, res) => {
  try {
    // Verify project belongs to user
    const { rows: pRows } = await pool.query(
      `SELECT p.id FROM projects p
       JOIN workspaces w ON w.id = p.workspace_id
       WHERE p.id = $1 AND w.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!pRows[0]) return res.status(404).json({ error: 'Project not found' });

    const budget = await getRemainingBudget(req.params.id);

    // Determine health status label
    let status = 'ok';
    if (budget.isExceeded)       status = 'exceeded';
    else if (budget.percentUsed >= 95) status = 'critical';
    else if (budget.percentUsed >= 80) status = 'warning';

    // Count blocked runs
    const { rows: blockedRows } = await pool.query(
      `SELECT COUNT(*) AS blocked_runs FROM agent_runs
       WHERE project_id = $1 AND budget_enforced = TRUE`,
      [req.params.id]
    );

    // Cost estimate for a typical 1 000-token call at default model
    const estimate = estimateCallCost('claude-sonnet-4-6', 1000);

    return res.json({
      status,
      ...budget,
      blockedRuns:    parseInt(blockedRows[0].blocked_runs, 10),
      costEstimate:   estimate,
    });
  } catch (err) {
    console.error('[GET /projects/:id/budget-status]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/projects/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM projects p
       USING workspaces w
       WHERE p.id = $1 AND p.workspace_id = w.id AND w.user_id = $2`,
      [req.params.id, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /projects/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
