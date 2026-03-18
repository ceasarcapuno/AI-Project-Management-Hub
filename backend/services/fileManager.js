// ─── File Manager Service ─────────────────────────────────────────────────────
// Centralises three file-output concerns:
//   1. Path-traversal protection  — sanitizeFilename / validateUploadPath
//   2. Per-user storage quotas    — checkUserQuota / getUserStorageStats
//   3. Orphan-file cleanup        — cleanupOrphanFiles
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');
const pool = require('../db');

const UPLOADS_ROOT      = process.env.UPLOADS_PATH   || '/app/uploads';
const DEFAULT_QUOTA_KB  = parseInt(process.env.STORAGE_QUOTA_KB || '524288', 10); // 512 MB

// ─── 1. Path-traversal protection ────────────────────────────────────────────

/**
 * Sanitize a user-supplied filename.
 * Strips directory components, control characters, and null bytes.
 * Returns a safe basename that can be used directly with path.join().
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return `output-${Date.now()}.md`;
  }

  // Keep only the final component (strips any leading path)
  let safe = path.basename(filename);

  // Remove null bytes and ASCII control characters
  safe = safe.replace(/[\x00-\x1f\x7f]/g, '');

  // Remove any leftover path separators (forward- and back-slash)
  safe = safe.replace(/[/\\]/g, '');

  // Trim leading dots / whitespace to avoid hidden-file tricks
  safe = safe.replace(/^[.\s]+/, '');

  // Hard cap at 200 characters so the full absolute path stays within limits
  if (safe.length > 200) safe = safe.slice(0, 200);

  // Fall back to a timestamped name if nothing useful remains
  if (!safe || safe === '') {
    safe = `output-${Date.now()}.md`;
  }

  return safe;
}

/**
 * Resolve filepath and verify it lives inside UPLOADS_ROOT.
 * Throws an error with status 400 if the resolved path escapes the root.
 */
function validateUploadPath(filepath) {
  const resolved = path.resolve(filepath);
  const root     = path.resolve(UPLOADS_ROOT);

  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    const err = new Error('Path traversal detected: filepath escapes the uploads root');
    err.status = 400;
    throw err;
  }

  return resolved;
}

// ─── 2. Per-user storage quotas ───────────────────────────────────────────────

/**
 * Return the total size_kb currently stored for a user (from the outputs table).
 */
async function getUserStorageKb(userId) {
  const { rows } = await pool.query(
    'SELECT COALESCE(SUM(size_kb), 0)::INTEGER AS total_kb FROM outputs WHERE user_id = $1',
    [userId]
  );
  return rows[0].total_kb;
}

/**
 * Return { usedKb, quotaKb, availableKb, percentUsed } for a user.
 */
async function getUserStorageStats(userId) {
  const { rows } = await pool.query(
    'SELECT storage_quota_kb FROM users WHERE id = $1',
    [userId]
  );
  if (!rows[0]) throw new Error('User not found');

  const quotaKb     = rows[0].storage_quota_kb ?? DEFAULT_QUOTA_KB;
  const usedKb      = await getUserStorageKb(userId);
  const availableKb = Math.max(0, quotaKb - usedKb);
  const percentUsed = quotaKb > 0 ? Math.round((usedKb / quotaKb) * 100) : 0;

  return { usedKb, quotaKb, availableKb, percentUsed };
}

/**
 * Throw a 507 Insufficient Storage error if writing additionalKb bytes would
 * push the user over their quota.
 */
async function checkUserQuota(userId, additionalKb = 0) {
  const { rows } = await pool.query(
    'SELECT storage_quota_kb FROM users WHERE id = $1',
    [userId]
  );
  if (!rows[0]) throw new Error('User not found');

  const quotaKb = rows[0].storage_quota_kb ?? DEFAULT_QUOTA_KB;
  const usedKb  = await getUserStorageKb(userId);

  if (usedKb + additionalKb > quotaKb) {
    const err = new Error(
      `Storage quota exceeded (used ${usedKb} KB + ${additionalKb} KB > limit ${quotaKb} KB).`
    );
    err.status        = 507;
    err.quotaExceeded = true;
    err.usedKb        = usedKb;
    err.quotaKb       = quotaKb;
    throw err;
  }
}

// ─── 3. Orphan-file cleanup ───────────────────────────────────────────────────

/**
 * Remove stale records and files in two passes:
 *
 *   Pass A — DB orphans:  outputs rows whose file no longer exists on disk.
 *   Pass B — FS orphans:  files on disk that have no matching outputs row.
 *
 * Returns a summary object: { dbOrphansRemoved, fsOrphansRemoved, errors[] }.
 */
async function cleanupOrphanFiles() {
  const summary = { dbOrphansRemoved: 0, fsOrphansRemoved: 0, errors: [] };

  // ── Pass A: DB records pointing to missing files ──────────────────────────
  try {
    const { rows } = await pool.query('SELECT id, filepath FROM outputs');

    for (const row of rows) {
      try {
        if (!fs.existsSync(row.filepath)) {
          await pool.query('DELETE FROM outputs WHERE id = $1', [row.id]);
          summary.dbOrphansRemoved++;
        }
      } catch (rowErr) {
        summary.errors.push(`DB-orphan check failed for ${row.id}: ${rowErr.message}`);
      }
    }
  } catch (err) {
    summary.errors.push(`DB orphan scan failed: ${err.message}`);
  }

  // ── Pass B: Disk files with no DB record ─────────────────────────────────
  try {
    const root = path.resolve(UPLOADS_ROOT);
    if (!fs.existsSync(root)) return summary;

    // Build a set of all known absolute paths (re-query after pass A)
    const { rows: knownRows } = await pool.query('SELECT filepath FROM outputs');
    const knownPaths = new Set(knownRows.map(r => path.resolve(r.filepath)));

    // Walk root / userId / projectId / filename  (exactly 3 levels deep)
    for (const lvl1 of fs.readdirSync(root)) {
      const dir1 = path.join(root, lvl1);
      if (!fs.statSync(dir1).isDirectory()) continue;

      for (const lvl2 of fs.readdirSync(dir1)) {
        const dir2 = path.join(dir1, lvl2);
        if (!fs.statSync(dir2).isDirectory()) continue;

        for (const filename of fs.readdirSync(dir2)) {
          const filePath = path.resolve(path.join(dir2, filename));
          if (!knownPaths.has(filePath)) {
            try {
              fs.unlinkSync(filePath);
              summary.fsOrphansRemoved++;
            } catch (delErr) {
              summary.errors.push(`Failed to delete orphan ${filePath}: ${delErr.message}`);
            }
          }
        }
      }
    }
  } catch (err) {
    summary.errors.push(`Filesystem orphan scan failed: ${err.message}`);
  }

  return summary;
}

module.exports = {
  sanitizeFilename,
  validateUploadPath,
  checkUserQuota,
  getUserStorageStats,
  cleanupOrphanFiles,
};
