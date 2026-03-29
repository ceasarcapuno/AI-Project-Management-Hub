// ─── AIPM Backend — Entry Point ───────────────────────────────────────────────
// Self-hosted Express API.
// Auth:     JWT (jsonwebtoken + bcrypt)
// Database: PostgreSQL via pg pool
// Storage:  Local filesystem (/app/uploads, Docker volume)
// Cache/RT: Redis (pub/sub for SSE notifications)
// AI:       Anthropic Claude claude-sonnet-4-6
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const { runMigrations } = require('./migrations/run');

const { cleanupOrphanFiles } = require('./services/fileManager');

// ─── Route Handlers ───────────────────────────────────────────────────────────
const authRouter          = require('./routes/auth');
const workspacesRouter    = require('./routes/workspaces');
const projectsRouter      = require('./routes/projects');
const milestonesRouter    = require('./routes/milestones');
const tasksRouter         = require('./routes/tasks');
const agentsRouter        = require('./routes/agents');
const notificationsRouter = require('./routes/notifications');
const outputsRouter       = require('./routes/outputs');
const chatRouter          = require('./routes/chat');
const apiKeysRouter       = require('./routes/apikeys');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:80',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: Origin "${origin}" is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
});
app.use('/api/', generalLimiter);
app.use('/api/chat', chatLimiter);

// ─── Request Logging (development) ───────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({
  status: 'ok', service: 'aipm-backend', version: '2.0.0',
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
}));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          authRouter);
app.use('/api/workspaces',    workspacesRouter);
app.use('/api/projects',      projectsRouter);
app.use('/api/milestones',    milestonesRouter);
app.use('/api/tasks',         tasksRouter);
app.use('/api/agents',        agentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/outputs',       outputsRouter);
app.use('/api/chat',          chatRouter);
app.use('/api/apikeys',       apiKeysRouter);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not Found', message: `No API endpoint: ${req.method} ${req.originalUrl}` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Global Error Handler]', { method: req.method, path: req.path, error: err.message });
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: 'Forbidden', message: err.message });
  }
  return res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV !== 'production' ? err.message : 'An unexpected error occurred.',
  });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  // Run DB migrations before accepting traffic
  await runMigrations();

  scheduleOrphanCleanup();

  app.listen(PORT, () => {
    console.log('');
    console.log('  ╔═══════════════════════════════════════════╗');
    console.log('  ║   AIPM — AI Project Management Hub        ║');
    console.log('  ║   Self-Hosted Backend API v2.0            ║');
    console.log('  ╚═══════════════════════════════════════════╝');
    console.log('');
    console.log(`  Server:  http://localhost:${PORT}`);
    console.log(`  Health:  http://localhost:${PORT}/api/health`);
    console.log(`  Env:     ${process.env.NODE_ENV || 'development'}`);
    console.log('');

    const required = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'ANTHROPIC_API_KEY'];
    const missing  = required.filter(v => !process.env[v]);
    if (missing.length > 0) {
      console.warn('  WARNING: Missing environment variables:');
      missing.forEach(v => console.warn(`    - ${v}`));
      console.warn('  Add these to your .env file.\n');
    } else {
      console.log('  Environment variables: OK\n');
    }
  });
}

// ─── Orphan-file Cleanup (runs every 6 hours) ─────────────────────────────────
const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS || '21600000', 10);

function scheduleOrphanCleanup() {
  setInterval(async () => {
    console.log('[cleanup] Starting orphan-file scan…');
    try {
      const summary = await cleanupOrphanFiles();
      console.log(
        `[cleanup] Done — DB orphans removed: ${summary.dbOrphansRemoved}, ` +
        `FS orphans removed: ${summary.fsOrphansRemoved}` +
        (summary.errors.length ? `, errors: ${summary.errors.join('; ')}` : '')
      );
    } catch (err) {
      console.error('[cleanup] Orphan scan failed:', err.message);
    }
  }, CLEANUP_INTERVAL_MS);
}

start().catch(err => {
  console.error('[startup] Fatal error:', err.message);
  process.exit(1);
});

module.exports = app;
