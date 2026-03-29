// ─── Claude Code Task Webhook ──────────────────────────────────────────────────
// POST /api/claude-tasks  — Maximus sends a coding task; Claude Code runs it
// GET  /api/claude-tasks  — capability / health check
//
// The actual execution happens in claude-runner.js on the HOST (127.0.0.1:3001)
// reached via host.docker.internal.  This route handles auth + proxying only.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const http    = require('http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const RUNNER_HOST = process.env.CLAUDE_RUNNER_HOST || 'host.docker.internal';
const RUNNER_PORT = parseInt(process.env.CLAUDE_RUNNER_PORT || '3001', 10);
const MAX_TASK    = 4000;

// ─── GET /api/claude-tasks ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await proxyToRunner('GET', '/health', null);
    return res.json({ ...result, authenticated_as: req.user.email });
  } catch (err) {
    return res.status(503).json({ error: 'Claude runner unreachable', detail: err.message });
  }
});

// ─── POST /api/claude-tasks ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { task, deploy = true } = req.body;

  if (!task || typeof task !== 'string' || !task.trim()) {
    return res.status(400).json({ error: 'task is required' });
  }
  if (task.length > MAX_TASK) {
    return res.status(400).json({ error: `task exceeds ${MAX_TASK} character limit` });
  }

  console.log(`[claude-tasks] ${req.user.email} submitted task: ${task.slice(0, 100)}…`);

  try {
    const result = await proxyToRunner('POST', '/run', { task: task.trim(), deploy });
    return res.json({ ...result, submitted_by: req.user.email });
  } catch (err) {
    console.error('[claude-tasks] Runner error:', err.message);
    return res.status(502).json({ error: 'Claude runner failed', detail: err.message });
  }
});

// ─── Proxy helper ─────────────────────────────────────────────────────────────
function proxyToRunner(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;

    const opts = {
      hostname: RUNNER_HOST,
      port:     RUNNER_PORT,
      path,
      method,
      headers: {
        'Content-Type':   'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout: 6 * 60 * 1000, // 6 min — claude task can take a while
    };

    const req = http.request(opts, (res2) => {
      let raw = '';
      res2.on('data', d => raw += d);
      res2.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve({ raw }); }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Runner timed out')); });
    req.on('error',   reject);

    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = router;
