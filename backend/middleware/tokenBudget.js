// ─── Token Budget Guard Middleware ────────────────────────────────────────────
// Factory that returns an Express middleware which:
//   1. Resolves the project ID from the current request
//   2. Queries the live token usage for that project
//   3. Emits SSE warning notifications at 80 % / 95 % / 100 % thresholds
//   4. Blocks the request with HTTP 429 when the budget is fully exhausted
//   5. Logs every blocked attempt as a budget_enforced agent_run row
//
// Usage:
//   const guard = createTokenBudgetGuard(async (req) => {
//     const { rows } = await pool.query(
//       'SELECT project_id FROM agents WHERE id = $1', [req.params.id]
//     );
//     return { projectId: rows[0].project_id, userId: req.user.id };
//   });
//   router.post('/:id/run', guard, handler);
// ─────────────────────────────────────────────────────────────────────────────

const pool  = require('../db');
const redis = require('../services/redis');
const { getRemainingBudget } = require('../services/tokenTracker');

// ─── Threshold definitions ────────────────────────────────────────────────────
const THRESHOLDS = [
  { pct: 100, level: 'error',   label: 'blocked',  title: 'Token Budget Exceeded'       },
  { pct:  95, level: 'warning', label: 'critical',  title: 'Token Budget Critical (95%)' },
  { pct:  80, level: 'warning', label: 'warning',   title: 'Token Budget Warning (80%)'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Publishes a budget-threshold notification to the user's SSE channel and
 * persists it to the notifications table.
 *
 * @param {string} userId
 * @param {string} projectId
 * @param {object} budget   - from getRemainingBudget()
 * @param {object} threshold - matching entry from THRESHOLDS
 */
async function emitBudgetNotification(userId, projectId, budget, threshold) {
  const summary =
    `Project has used ${budget.tokenUsed.toLocaleString()} of ` +
    `${budget.tokenLimit.toLocaleString()} tokens ` +
    `(${budget.percentUsed.toFixed(1)}%).`;

  const { rows } = await pool.query(
    `INSERT INTO notifications
       (user_id, type, level, title, summary, project, token_used, token_limit)
     VALUES ($1, 'budget', $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      threshold.level,
      threshold.title,
      summary,
      projectId,
      budget.tokenUsed,
      budget.tokenLimit,
    ]
  );

  try {
    await redis.publish(`notifications:${userId}`, JSON.stringify(rows[0]));
  } catch (_) {
    // Redis publish is best-effort — never crash the request over it
  }
}

/**
 * Inserts a zero-token agent_run row flagged as budget_enforced.
 * This provides an audit trail of every blocked execution attempt.
 *
 * @param {string} projectId
 */
async function logBlockedRun(projectId) {
  await pool.query(
    `INSERT INTO agent_runs
       (project_id, tokens_input, tokens_output, tokens_total, cost, budget_enforced)
     VALUES ($1, 0, 0, 0, 0, TRUE)`,
    [projectId]
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an Express middleware that enforces the token budget for a project.
 *
 * @param {function(import('express').Request): Promise<{projectId: string, userId: string}>} resolveIds
 *   Async function that extracts projectId and userId from the request.
 *   Called before any budget check.  Should throw if the resource is not found.
 *
 * @returns {import('express').RequestHandler}
 */
function createTokenBudgetGuard(resolveIds) {
  return async (req, res, next) => {
    let projectId, userId;

    try {
      ({ projectId, userId } = await resolveIds(req));
    } catch (err) {
      // If we can't resolve the project let the main handler surface the 404
      console.warn('[tokenBudget] Could not resolve project IDs:', err.message);
      return next();
    }

    try {
      const budget = await getRemainingBudget(projectId);
      const pct    = budget.percentUsed;

      // ── Emit threshold notifications (best-effort, non-blocking) ─────────
      const threshold = THRESHOLDS.find(t => pct >= t.pct);
      if (threshold) {
        emitBudgetNotification(userId, projectId, budget, threshold).catch((err) => {
          console.warn('[tokenBudget] SSE notification failed (non-fatal):', err.message);
        });
      }

      // ── Hard block at 100 % ───────────────────────────────────────────────
      if (budget.isExceeded) {
        logBlockedRun(projectId).catch(() => {});

        console.warn(
          `[tokenBudget] BLOCKED — project ${projectId}: ` +
          `${budget.tokenUsed}/${budget.tokenLimit} tokens used`
        );

        return res.status(429).json({
          error:
            `Token budget exceeded for this project. ` +
            `Current: ${budget.tokenUsed} tokens, Limit: ${budget.tokenLimit} tokens.`,
          tokenUsed:   budget.tokenUsed,
          tokenLimit:  budget.tokenLimit,
          percentUsed: parseFloat(pct.toFixed(2)),
          remaining:   0,
        });
      }

      // ── Attach budget snapshot for downstream handlers ────────────────────
      req.projectBudget = budget;
      req.projectId     = projectId;

      next();
    } catch (err) {
      console.error('[tokenBudget] Budget check failed:', err.message);
      next(err);
    }
  };
}

module.exports = { createTokenBudgetGuard };
