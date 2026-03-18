-- ─── Storage Quota & Output Ownership ────────────────────────────────────────
-- Adds per-user disk-space quota (default 512 MB) and a direct user_id FK on
-- outputs so storage usage can be summed in a single indexed query.
-- ─────────────────────────────────────────────────────────────────────────────

-- 512 MB default quota per user (in kilobytes)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS storage_quota_kb INTEGER NOT NULL DEFAULT 524288;

-- Direct user ownership on every output row
ALTER TABLE outputs
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Back-fill for existing task-linked outputs
UPDATE outputs o
SET    user_id = w.user_id
FROM   tasks t
JOIN   milestones m ON m.id = t.milestone_id
JOIN   projects  p  ON p.id = m.project_id
JOIN   workspaces w ON w.id = p.workspace_id
WHERE  o.task_id = t.id
  AND  o.user_id IS NULL;

-- Index for fast per-user quota aggregation
CREATE INDEX IF NOT EXISTS idx_outputs_user_id ON outputs(user_id);
