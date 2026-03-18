// ─── Notifications Router ─────────────────────────────────────────────────────
// Mounted at: /api/notifications
// GET /stream — SSE endpoint (token via ?token= query param for EventSource compat)
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const Redis   = require('ioredis');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/notifications/stream (SSE — NO requireAuth middleware) ──────────
// EventSource cannot set headers, so the JWT is passed as ?token=<jwt>
router.get('/stream', (req, res) => {
  const token = req.query.token;
  if (!token) {
    res.status(401).end();
    return;
  }

  let userId;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    userId = payload.sub;
  } catch (_) {
    res.status(401).end();
    return;
  }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const sub     = new Redis(process.env.REDIS_URL);
  const channel = `notifications:${userId}`;

  sub.subscribe(channel, (err) => {
    if (err) {
      console.error('[SSE] Redis subscribe error:', err.message);
      res.end();
    }
  });

  sub.on('message', (_ch, message) => {
    res.write(`data: ${message}\n\n`);
  });

  // Heartbeat every 25 s
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sub.unsubscribe(channel);
    sub.quit();
  });
});

// Apply auth middleware to all remaining routes
router.use(requireAuth);

// ─── GET /api/notifications ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { unread_only } = req.query;
    let sql = 'SELECT * FROM notifications WHERE user_id = $1';
    if (unread_only === 'true') sql += ' AND read = FALSE';
    sql += ' ORDER BY created_at DESC LIMIT 100';

    const { rows } = await pool.query(sql, [req.user.id]);
    return res.json(rows);
  } catch (err) {
    console.error('[GET /notifications]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/notifications ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { type = 'system', level = 'info', title, summary, detail, project, agent, actions, token_used, token_limit } = req.body;
    if (!title || title.trim() === '') return res.status(400).json({ error: 'title is required' });

    const { rows } = await pool.query(
      `INSERT INTO notifications (user_id, type, level, title, summary, detail, project, agent, actions, token_used, token_limit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, type, level, title.trim(), summary ?? null, detail ?? null,
       project ?? null, agent ?? null,
       actions ? JSON.stringify(actions) : null,
       token_used ?? null, token_limit ?? null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /notifications]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/notifications/mark-all-read ───────────────────────────────────
router.patch('/mark-all-read', async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE',
      [req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[PATCH /notifications/mark-all-read]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/notifications/:id ────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE notifications SET read = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [Boolean(req.body.read), req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Notification not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[PATCH /notifications/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/notifications/:id ───────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /notifications/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
