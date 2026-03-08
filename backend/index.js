// ─── AIPM Backend — Entry Point ───────────────────────────────────────────────
// Express server for the AI Project Management Hub.
// Provides a REST API consumed by the Vite/React frontend.
//
// Architecture:
//   - Authentication: Supabase JWT (verified in middleware/auth.js)
//   - Database:       Supabase Postgres (via @supabase/supabase-js)
//   - Storage:        Supabase Storage (agent-outputs bucket)
//   - AI:             Anthropic SDK (claude-sonnet-4-6)
// ─────────────────────────────────────────────────────────────────────────────

// Load environment variables from the root .env file
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// ─── Route Handlers ───────────────────────────────────────────────────────────
const workspacesRouter    = require('./routes/workspaces');
const projectsRouter      = require('./routes/projects');
const milestonesRouter    = require('./routes/milestones');
const tasksRouter         = require('./routes/tasks');
const agentsRouter        = require('./routes/agents');
const notificationsRouter = require('./routes/notifications');
const outputsRouter       = require('./routes/outputs');
const chatRouter          = require('./routes/chat');

// ─── App Initialisation ───────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow requests from the Vite dev server and any configured frontend URL.
const allowedOrigins = [
  'http://localhost:5173',         // Vite dev server (default)
  'http://localhost:3000',         // Alternate local dev port
  process.env.FRONTEND_URL,       // Production frontend URL (from env)
].filter(Boolean); // Remove undefined/null entries

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin "${origin}" is not allowed`));
  },
  credentials: true,                // Allow cookies and auth headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
// 10mb limit to accommodate base64-encoded file content in request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// General limit: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,     // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,      // Disable X-RateLimit-* headers
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please wait before making more requests.',
    retryAfter: '15 minutes',
  },
  skip: (req) => req.path === '/api/health', // Don't rate-limit health checks
});

// Chat limit: 20 requests per 15 minutes per IP (AI calls are expensive)
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Chat rate limit exceeded',
    message: 'You have made too many AI requests. Please wait 15 minutes before trying again.',
    retryAfter: '15 minutes',
  },
});

// Apply general limiter to all /api/ routes
app.use('/api/', generalLimiter);

// Apply stricter limiter specifically to chat routes
app.use('/api/chat', chatLimiter);

// ─── Request Logging (development) ───────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
  });
}

// ─── Health Check ─────────────────────────────────────────────────────────────
// Simple endpoint for load balancers and uptime monitors.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'aipm-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/workspaces',    workspacesRouter);
app.use('/api/projects',      projectsRouter);
app.use('/api/milestones',    milestonesRouter);
app.use('/api/tasks',         tasksRouter);
app.use('/api/agents',        agentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/outputs',       outputsRouter);
app.use('/api/chat',          chatRouter);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
// Catch-all for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No API endpoint found for ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Catches any unhandled errors thrown in route handlers
app.use((err, req, res, _next) => {
  console.error('[Global Error Handler]', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  // Handle CORS errors specifically
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: 'Forbidden', message: err.message });
  }

  return res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV !== 'production'
      ? err.message
      : 'An unexpected error occurred. Please try again.',
  });
});

// ─── Server Startup ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║   AIPM — AI Project Management Hub        ║');
  console.log('  ║   Backend API Server                      ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');
  console.log(`  Server:      http://localhost:${PORT}`);
  console.log(`  Health:      http://localhost:${PORT}/api/health`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  CORS:        ${allowedOrigins.join(', ')}`);
  console.log('');
  console.log('  Routes mounted:');
  console.log('    GET    /api/health');
  console.log('    *      /api/workspaces');
  console.log('    *      /api/projects');
  console.log('    *      /api/milestones');
  console.log('    *      /api/tasks');
  console.log('    *      /api/agents');
  console.log('    *      /api/notifications');
  console.log('    *      /api/outputs');
  console.log('    *      /api/chat');
  console.log('');

  // Warn if critical env vars are missing
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'ANTHROPIC_API_KEY'];
  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingVars.length > 0) {
    console.warn('  WARNING: Missing required environment variables:');
    missingVars.forEach((v) => console.warn(`    - ${v}`));
    console.warn('  Add these to your .env file.\n');
  } else {
    console.log('  Environment variables: OK\n');
  }
});

module.exports = app; // Export for testing
