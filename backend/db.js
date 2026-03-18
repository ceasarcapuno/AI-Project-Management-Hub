// ─── PostgreSQL connection pool ───────────────────────────────────────────────
// Single shared pool used by all route handlers.
// Reads DATABASE_URL from environment — never hardcoded.
// ─────────────────────────────────────────────────────────────────────────────

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

module.exports = pool;
