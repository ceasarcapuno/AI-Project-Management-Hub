// ─── Token Tracker Service ────────────────────────────────────────────────────
// Provides helpers for reading and writing token usage against projects.
// All writes go to both the projects summary columns and the agent_runs log
// so that per-run history is preserved without re-scanning every run.
// ─────────────────────────────────────────────────────────────────────────────

const pool = require('../db');

// Per-token cost in USD.  Kept in sync with anthropic.js constants.
const MODEL_PRICING = {
  'claude-sonnet-4-6': { input: 0.000003,  output: 0.000015  },
  'claude-opus-4-6':   { input: 0.000015,  output: 0.000075  },
  'claude-haiku-4-5':  { input: 0.0000008, output: 0.000004  },
};
const DEFAULT_PRICING = MODEL_PRICING['claude-sonnet-4-6'];

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current token usage snapshot for a project.
 *
 * @param {string} projectId
 * @returns {Promise<{
 *   tokenUsed:    number,
 *   tokenLimit:   number,
 *   cost:         number,
 *   percentUsed:  number,
 * }>}
 */
async function getProjectTokenUsage(projectId) {
  const { rows } = await pool.query(
    'SELECT token_used, token_limit, cost FROM projects WHERE id = $1',
    [projectId]
  );
  if (!rows[0]) throw new Error(`Project not found: ${projectId}`);

  const tokenUsed  = rows[0].token_used  ?? 0;
  const tokenLimit = rows[0].token_limit ?? 200000;
  const cost       = parseFloat(rows[0].cost) || 0;

  return {
    tokenUsed,
    tokenLimit,
    cost,
    percentUsed: tokenLimit > 0 ? (tokenUsed / tokenLimit) * 100 : 0,
  };
}

/**
 * Adds token usage to a project's running totals and appends an agent_run row.
 * Called AFTER a successful agent/task execution.
 *
 * @param {string}      projectId
 * @param {string|null} agentId       UUID of the agents row (null for task-only runs)
 * @param {{
 *   inputTokens:  number,
 *   outputTokens: number,
 *   model?:       string,
 *   taskId?:      string|null,
 *   budgetEnforced?: boolean,
 * }} tokens
 * @returns {Promise<{ totalTokens: number, cost: number }>}
 */
async function addTokenUsage(projectId, agentId, tokens) {
  const {
    inputTokens  = 0,
    outputTokens = 0,
    model        = 'claude-sonnet-4-6',
    taskId       = null,
    budgetEnforced = false,
  } = tokens;

  const pricing     = MODEL_PRICING[model] || DEFAULT_PRICING;
  const totalTokens = inputTokens + outputTokens;
  const cost        = inputTokens * pricing.input + outputTokens * pricing.output;

  // Update project summary (single row, always consistent)
  await pool.query(
    `UPDATE projects SET token_used = token_used + $1, cost = cost + $2 WHERE id = $3`,
    [totalTokens, cost, projectId]
  );

  // Append per-run audit row
  await pool.query(
    `INSERT INTO agent_runs
       (project_id, agent_id, task_id, tokens_input, tokens_output,
        tokens_total, cost, model, budget_enforced)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [projectId, agentId ?? null, taskId ?? null,
     inputTokens, outputTokens, totalTokens, cost, model, budgetEnforced]
  );

  return { totalTokens, cost };
}

/**
 * Returns remaining token budget for a project.
 *
 * @param {string} projectId
 * @returns {Promise<{
 *   tokenUsed:    number,
 *   tokenLimit:   number,
 *   cost:         number,
 *   percentUsed:  number,
 *   remaining:    number,
 *   isExceeded:   boolean,
 * }>}
 */
async function getRemainingBudget(projectId) {
  const usage = await getProjectTokenUsage(projectId);
  return {
    ...usage,
    remaining:  Math.max(0, usage.tokenLimit - usage.tokenUsed),
    isExceeded: usage.tokenUsed >= usage.tokenLimit,
  };
}

/**
 * Estimates the USD cost of a future API call without making it.
 * Assumes a 30/70 input/output split as a rough heuristic.
 *
 * @param {string} model            - Anthropic model identifier
 * @param {number} estimatedTokens  - Total tokens expected (input + output)
 * @returns {{
 *   model:           string,
 *   estimatedTokens: number,
 *   estimatedInput:  number,
 *   estimatedOutput: number,
 *   estimatedCost:   number,
 *   inputRate:       number,
 *   outputRate:      number,
 * }}
 */
function estimateCallCost(model, estimatedTokens) {
  const pricing        = MODEL_PRICING[model] || DEFAULT_PRICING;
  const estimatedInput  = Math.floor(estimatedTokens * 0.3);
  const estimatedOutput = Math.floor(estimatedTokens * 0.7);
  const estimatedCost   = estimatedInput * pricing.input + estimatedOutput * pricing.output;

  return {
    model,
    estimatedTokens,
    estimatedInput,
    estimatedOutput,
    estimatedCost,
    inputRate:  pricing.input,
    outputRate: pricing.output,
  };
}

module.exports = {
  getProjectTokenUsage,
  addTokenUsage,
  getRemainingBudget,
  estimateCallCost,
  MODEL_PRICING,
};
