// ─── Authentication Middleware ─────────────────────────────────────────────────
// Supports two methods:
//   1. JWT Bearer token  — Authorization: Bearer <jwt>
//   2. API Key           — X-API-Key: aipm_<key>  (persistent, never expires)
// On success: attaches req.user = { id, email, name } to the request.
// ─────────────────────────────────────────────────────────────────────────────

const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool   = require('../db');

async function requireAuth(req, res, next) {
  try {
    // ── Method 1: API Key via X-API-Key header ──────────────────────────────
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey.startsWith('aipm_')) {
      const { rows } = await pool.query(
        `SELECT ak.id, ak.key_hash, ak.user_id,
                u.email, u.name
         FROM api_keys ak
         JOIN users u ON u.id = ak.user_id
         WHERE ak.key_prefix = $1`,
        [apiKey.slice(0, 12)]
      );

      for (const row of rows) {
        const match = await bcrypt.compare(apiKey, row.key_hash);
        if (match) {
          // Update last_used (fire and forget)
          pool.query('UPDATE api_keys SET last_used = NOW() WHERE id = $1', [row.id])
            .catch(() => {});
          req.user = { id: row.user_id, email: row.email, name: row.name };
          return next();
        }
      }
      return res.status(401).json({ error: 'Unauthorised', message: 'Invalid API key' });
    }

    // ── Method 2: JWT Bearer token ──────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorised',
        message: 'Provide Authorization: Bearer <jwt>  or  X-API-Key: aipm_<key>',
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Unauthorised', message: 'Bearer token is empty' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    return next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorised', message: 'Token has expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Unauthorised', message: 'Invalid token' });
    }
    console.error('[requireAuth] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = { requireAuth };
