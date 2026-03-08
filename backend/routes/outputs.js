// ─── Outputs Router ───────────────────────────────────────────────────────────
// Mounted at: /api/outputs
// Files are served directly from the local filesystem via a download stream.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const pool    = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ─── GET /api/outputs ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { task_id } = req.query;
    if (!task_id) return res.status(400).json({ error: 'task_id is required' });

    const { rows } = await pool.query(
      'SELECT * FROM outputs WHERE task_id = $1 ORDER BY created_at DESC',
      [task_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[GET /outputs]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/outputs/:id/download ────────────────────────────────────────────
// Streams the file from disk with Content-Disposition: attachment.
router.get('/:id/download', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.* FROM outputs o
       LEFT JOIN tasks t ON t.id = o.task_id
       LEFT JOIN milestones m ON m.id = t.milestone_id
       LEFT JOIN projects p ON p.id = m.project_id
       LEFT JOIN workspaces w ON w.id = p.workspace_id
       WHERE o.id = $1 AND (w.user_id = $2 OR o.task_id IS NULL)`,
      [req.params.id, req.user.id]
    );

    const output = rows[0];
    if (!output) return res.status(404).json({ error: 'Output not found or access denied' });

    if (!fs.existsSync(output.filepath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${output.filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const stream = fs.createReadStream(output.filepath);
    stream.pipe(res);
  } catch (err) {
    console.error('[GET /outputs/:id/download]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/outputs/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.* FROM outputs o
       LEFT JOIN tasks t ON t.id = o.task_id
       LEFT JOIN milestones m ON m.id = t.milestone_id
       LEFT JOIN projects p ON p.id = m.project_id
       LEFT JOIN workspaces w ON w.id = p.workspace_id
       WHERE o.id = $1 AND (w.user_id = $2 OR o.task_id IS NULL)`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Output not found or access denied' });

    // Delete file from disk (best-effort)
    try { if (fs.existsSync(rows[0].filepath)) fs.unlinkSync(rows[0].filepath); } catch (_) {}

    await pool.query('DELETE FROM outputs WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /outputs/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
