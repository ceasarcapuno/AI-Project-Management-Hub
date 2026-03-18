// ─── Workspaces Router ────────────────────────────────────────────────────────
// Mounted at: /api/workspaces
// All routes scoped to req.user.id — users cannot see each other's workspaces.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const pool    = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/workspaces
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM workspaces WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[GET /workspaces]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/workspaces
router.post('/', async (req, res) => {
  try {
    const { label, type = 'private' } = req.body;

    if (!label || typeof label !== 'string' || label.trim() === '') {
      return res.status(400).json({ error: 'Workspace label is required' });
    }
    const validTypes = ['private', 'business', 'work'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    const { rows } = await pool.query(
      `INSERT INTO workspaces (user_id, label, type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, label.trim(), type]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /workspaces]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/workspaces/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { label, type } = req.body;

    const sets = [];
    const vals = [];
    let   idx  = 1;

    if (label !== undefined) { sets.push(`label = $${idx++}`); vals.push(label.trim()); }
    if (type  !== undefined) { sets.push(`type = $${idx++}`);  vals.push(type); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields provided for update' });

    vals.push(id, req.user.id);
    const { rows } = await pool.query(
      `UPDATE workspaces SET ${sets.join(', ')}
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Workspace not found or access denied' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /workspaces/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workspaces/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM workspaces WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /workspaces/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
