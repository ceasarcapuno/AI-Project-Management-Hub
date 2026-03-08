// ─── Migration Runner ──────────────────────────────────────────────────────────
// Reads all *.sql files from this directory in order and executes them.
// Called once on application startup.  All SQL uses IF NOT EXISTS so it is
// safe to run on every boot against an already-migrated database.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigrations() {
  const dir   = __dirname;
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // alphabetical → numeric order via 001_, 002_, …

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`[migrations] Running ${file}…`);
      await client.query(sql);
      console.log(`[migrations] ${file} OK`);
    }
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
