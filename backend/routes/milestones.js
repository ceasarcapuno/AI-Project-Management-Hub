// ─── Milestones Router ────────────────────────────────────────────────────────
// Mounted at: /api/milestones
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const pool    = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Helper: verify project belongs to user
async function assertProjectOwner(projectId, userId) {
  const { rows } = await pool.query(
    `SELECT p.id FROM projects p JOIN workspaces w ON w.id = p.workspace_id
     WHERE p.id = $1 AND w.user_id = $2`,
    [projectId, userId]
  );
  return !!rows[0];
}

// GET /api/milestones?project_id=
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    if (!await assertProjectOwner(project_id, req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM milestones WHERE project_id = $1 ORDER BY position ASC',
      [project_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[GET /milestones]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/milestones
router.post('/', async (req, res) => {
  try {
    const { project_id, name, status = 'todo', position = 0 } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Milestone name is required' });

    if (!await assertProjectOwner(project_id, req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { rows } = await pool.query(
      `INSERT INTO milestones (project_id, name, status, position)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [project_id, name.trim(), status, Number(position)]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /milestones]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/milestones/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, position } = req.body;

    const sets = [];
    const vals = [];
    let   idx  = 1;

    if (name     !== undefined) { sets.push(`name = $${idx++}`);     vals.push(name.trim()); }
    if (status   !== undefined) { sets.push(`status = $${idx++}`);   vals.push(status); }
    if (position !== undefined) { sets.push(`position = $${idx++}`); vals.push(Number(position)); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields provided for update' });

    vals.push(id, req.user.id);
    const { rows } = await pool.query(
      `UPDATE milestones m SET ${sets.join(', ')}
       FROM projects p JOIN workspaces w ON w.id = p.workspace_id
       WHERE m.id = $${idx++} AND m.project_id = p.id AND w.user_id = $${idx}
       RETURNING m.*`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Milestone not found or access denied' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /milestones/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/milestones/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM milestones m
       USING projects p JOIN workspaces w ON w.id = p.workspace_id
       WHERE m.id = $1 AND m.project_id = p.id AND w.user_id = $2`,
      [req.params.id, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /milestones/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
