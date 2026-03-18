-- ─── Token Budget Enforcement Schema ─────────────────────────────────────────
-- Idempotent (safe to run on every boot).
-- ─────────────────────────────────────────────────────────────────────────────

-- Per-execution audit log.  One row per agent/task run attempt.
-- budget_enforced = TRUE means the run was blocked before calling the API.
CREATE TABLE IF NOT EXISTS agent_runs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID        REFERENCES projects(id) ON DELETE CASCADE,
  agent_id         UUID        REFERENCES agents(id)   ON DELETE SET NULL,
  task_id          UUID        REFERENCES tasks(id)    ON DELETE SET NULL,
  tokens_input     INTEGER     NOT NULL DEFAULT 0,
  tokens_output    INTEGER     NOT NULL DEFAULT 0,
  tokens_total     INTEGER     NOT NULL DEFAULT 0,
  cost             NUMERIC     NOT NULL DEFAULT 0,
  model            TEXT,
  budget_enforced  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_agent_runs_project_id  ON agent_runs (project_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id    ON agent_runs (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_task_id     ON agent_runs (task_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_enforced    ON agent_runs (project_id, budget_enforced)
  WHERE budget_enforced = TRUE;
