// ─── API Keys Router ───────────────────────────────────────────────────────────
// GET    /api/apikeys       — list user's API keys (no secrets returned)
// POST   /api/apikeys       — create new key (secret returned ONCE)
// DELETE /api/apikeys/:id   — revoke a key
// ─────────────────────────────────────────────────────────────────────────────

const express  = require('express');
const crypto   = require('crypto');
const bcrypt   = require('bcrypt');
const pool     = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ─── GET /api/apikeys ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, key_prefix, last_used, created_at
       FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[GET /apikeys]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/apikeys ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Key name is required' });
    }

    // Generate: aipm_ + 32 random hex chars
    const rawKey   = 'aipm_' + crypto.randomBytes(20).toString('hex');
    const prefix   = rawKey.slice(0, 12);          // "aipm_" + 7 chars for display
    const keyHash  = await bcrypt.hash(rawKey, 10);

    const { rows } = await pool.query(
      `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, key_prefix, created_at`,
      [req.user.id, name.trim(), keyHash, prefix]
    );

    // Return raw key ONCE — never stored in plain text
    return res.status(201).json({ ...rows[0], key: rawKey });
  } catch (err) {
    console.error('[POST /apikeys]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/apikeys/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM api_keys WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Key not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /apikeys/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
