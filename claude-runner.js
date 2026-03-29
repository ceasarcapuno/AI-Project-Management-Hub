// ─── AIPM Claude Code Runner ───────────────────────────────────────────────────
// Runs on the HOST (not inside Docker) so it has git + docker compose access.
// Listens on 0.0.0.0:3001 — only reachable from the backend container via
// host.docker.internal, never exposed to the internet directly.
//
// Start:  node /opt/aipm/claude-runner.js
// Manage: sudo systemctl start aipm-claude-runner
// ─────────────────────────────────────────────────────────────────────────────

// env vars are injected by systemd EnvironmentFile=/opt/aipm/.env
const http     = require('http');
const { execFile } = require('child_process');

const PORT     = parseInt(process.env.CLAUDE_RUNNER_PORT || '3001', 10);
const REPO_DIR = process.env.REPO_DIR || '/opt/aipm';
const TIMEOUT  = 5 * 60 * 1000; // 5 min per task

// ─── Helpers ──────────────────────────────────────────────────────────────────
function run(bin, args, opts) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { ...opts, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }));
      resolve({ stdout, stderr });
    });
  });
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', d => { raw += d; if (raw.length > 64_000) reject(new Error('Body too large')); });
    req.on('end',  () => resolve(raw));
    req.on('error', reject);
  });
}

// ─── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { status: 'ok', service: 'claude-runner', repo: REPO_DIR });
  }

  // Execute task
  if (req.method === 'POST' && req.url === '/run') {
    let body;
    try {
      const raw = await readBody(req);
      body = JSON.parse(raw);
    } catch {
      return json(res, 400, { error: 'Invalid JSON body' });
    }

    const { task, deploy = true } = body;
    if (!task || typeof task !== 'string' || !task.trim()) {
      return json(res, 400, { error: 'task is required' });
    }

    console.log(`[claude-runner] Task received: ${task.slice(0, 100)}…`);

    // ── Run claude -p ────────────────────────────────────────────────────────
    let claudeResult;
    try {
      claudeResult = await run('claude', ['-p', task.trim(), '--output-format', 'text'], {
        cwd: REPO_DIR,
        timeout: TIMEOUT,
        env: { ...process.env },
      });
      console.log('[claude-runner] claude finished OK');
    } catch (err) {
      console.error('[claude-runner] claude failed:', err.message);
      return json(res, 500, {
        success: false,
        error:   err.message,
        stdout:  err.stdout || '',
        stderr:  err.stderr || '',
      });
    }

    // ── Optionally redeploy ──────────────────────────────────────────────────
    // Fire-and-forget: respond to Maximus first, then rebuild in background
    json(res, 200, {
      success: true,
      claude:  claudeResult,
      deploy:  deploy ? 'triggered' : 'skipped',
    });

    if (deploy) {
      console.log('[claude-runner] Triggering update.sh in background…');
      run('bash', ['/opt/aipm/update.sh'], { cwd: REPO_DIR, timeout: TIMEOUT })
        .then(() => console.log('[claude-runner] update.sh finished'))
        .catch(e  => console.error('[claude-runner] update.sh failed:', e.message));
    }

    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[claude-runner] Listening on 0.0.0.0:${PORT}`);
  console.log(`[claude-runner] Repo: ${REPO_DIR}`);
  console.log(`[claude-runner] ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'MISSING'}`);
});

server.on('error', err => {
  console.error('[claude-runner] Server error:', err.message);
  process.exit(1);
});
