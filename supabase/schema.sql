-- ═══════════════════════════════════════════════════════════════════════════
-- AIPM — AI Project Management Hub — Database Schema
-- Run this in your Supabase SQL Editor to create all tables with RLS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Enable Required Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUM Types ──────────────────────────────────────────────────────────────
CREATE TYPE workspace_type    AS ENUM ('private', 'business', 'work');
CREATE TYPE project_status    AS ENUM ('active', 'paused', 'completed', 'archived');
CREATE TYPE milestone_status  AS ENUM ('completed', 'in_progress', 'pending', 'blocked');
CREATE TYPE task_status       AS ENUM ('completed', 'in_progress', 'pending', 'failed');
CREATE TYPE agent_status      AS ENUM ('active', 'idle', 'completed', 'error');
CREATE TYPE message_type      AS ENUM ('briefing', 'alert', 'prose', 'report', 'user');
CREATE TYPE notif_level       AS ENUM ('info', 'warning', 'error', 'success');
CREATE TYPE notif_category    AS ENUM (
  'milestone', 'agent', 'task', 'output', 'cost', 'deadline', 'system', 'collaboration'
);
CREATE TYPE agent_type        AS ENUM (
  'Research', 'Code', 'Design', 'Strategy', 'Marketing',
  'Analysis', 'Writing', 'QA', 'DevOps', 'Security', 'Data', 'Product'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: workspaces
-- Each user can have multiple workspaces (Private / Business / Work)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE workspaces (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        workspace_type NOT NULL DEFAULT 'private',
  description TEXT,
  color       TEXT,                   -- Hex color for workspace identity
  icon        TEXT,                   -- Emoji or icon name
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: projects
-- Core project entity linked to a workspace
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  goal            TEXT,                    -- High-level project goal / brief
  status          project_status NOT NULL DEFAULT 'active',
  due_date        DATE,
  total_cost      DECIMAL(10,4) DEFAULT 0, -- Total API cost in USD
  tokens_used     BIGINT DEFAULT 0,        -- Cumulative tokens consumed
  progress        INT DEFAULT 0,           -- 0–100 overall progress
  tags            TEXT[],                  -- e.g. ['AI', 'MVP', 'Q1']
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: milestones
-- High-level phases within a project
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE milestones (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  status      milestone_status NOT NULL DEFAULT 'pending',
  due_date    DATE,
  order_idx   INT DEFAULT 0,             -- Display order
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: tasks
-- Granular work items within a milestone, assigned to an agent type
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id        UUID REFERENCES milestones(id) ON DELETE SET NULL,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  status              task_status NOT NULL DEFAULT 'pending',
  assigned_agent_type agent_type,
  model               TEXT DEFAULT 'claude-sonnet-4-6',
  priority            TEXT DEFAULT 'medium',   -- low / medium / high / critical
  estimated_tokens    INT DEFAULT 0,
  actual_tokens       INT DEFAULT 0,
  cost                DECIMAL(10,6) DEFAULT 0,
  order_idx           INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: agents
-- AI sub-agent instances running within a project
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE agents (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        agent_type NOT NULL,
  model       TEXT DEFAULT 'claude-sonnet-4-6',
  status      agent_status NOT NULL DEFAULT 'idle',
  cost        DECIMAL(10,6) DEFAULT 0,    -- Cost incurred by this agent
  tasks_done  INT DEFAULT 0,
  tokens_used INT DEFAULT 0,
  last_active TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: thread_messages
-- Chat / event thread for a project (AI PM + sub-agents + user)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE thread_messages (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_name    TEXT NOT NULL,              -- 'AIPM', agent name, or user display name
  from_type    TEXT NOT NULL DEFAULT 'aipm', -- 'aipm' | 'agent' | 'user'
  agent_id     UUID REFERENCES agents(id) ON DELETE SET NULL,
  type         message_type NOT NULL DEFAULT 'prose',
  content      TEXT NOT NULL,             -- Main message body (Markdown supported)
  deliverables JSONB DEFAULT '[]',        -- Array of {label, status, output_id?}
  metadata     JSONB DEFAULT '{}',        -- Extra structured data for report cards
  tokens_used  INT DEFAULT 0,
  cost         DECIMAL(10,6) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: notifications
-- Per-user notifications with real-time updates via Supabase subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  category    notif_category NOT NULL DEFAULT 'system',
  level       notif_level NOT NULL DEFAULT 'info',
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  actions     JSONB DEFAULT '[]',         -- [{label, href, style}]
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: outputs
-- Files generated by agents, stored in Supabase Storage
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE outputs (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id      UUID REFERENCES tasks(id) ON DELETE SET NULL,
  agent_id     UUID REFERENCES agents(id) ON DELETE SET NULL,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  file_type    TEXT NOT NULL,              -- 'md' | 'json' | 'txt' | 'csv' | etc.
  file_size    INT DEFAULT 0,              -- Size in bytes
  storage_path TEXT NOT NULL,             -- Supabase Storage bucket path
  description  TEXT,
  is_public    BOOLEAN DEFAULT FALSE,
  download_url TEXT,                       -- Signed URL cache (refreshed on demand)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES — improve query performance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_workspaces_user_id         ON workspaces(user_id);
CREATE INDEX idx_projects_workspace_id      ON projects(workspace_id);
CREATE INDEX idx_projects_user_id           ON projects(user_id);
CREATE INDEX idx_milestones_project_id      ON milestones(project_id);
CREATE INDEX idx_tasks_project_id           ON tasks(project_id);
CREATE INDEX idx_tasks_milestone_id         ON tasks(milestone_id);
CREATE INDEX idx_agents_project_id          ON agents(project_id);
CREATE INDEX idx_thread_messages_project_id ON thread_messages(project_id);
CREATE INDEX idx_thread_messages_created_at ON thread_messages(created_at);
CREATE INDEX idx_notifications_user_id      ON notifications(user_id);
CREATE INDEX idx_notifications_is_read      ON notifications(is_read);
CREATE INDEX idx_outputs_project_id         ON outputs(project_id);
CREATE INDEX idx_outputs_agent_id           ON outputs(agent_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER — auto-update the updated_at column on row modification
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspaces_updated_at  BEFORE UPDATE ON workspaces  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_projects_updated_at    BEFORE UPDATE ON projects    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_milestones_updated_at  BEFORE UPDATE ON milestones  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated_at       BEFORE UPDATE ON tasks       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agents_updated_at      BEFORE UPDATE ON agents      FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — users only see their own data
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE workspaces      ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE outputs         ENABLE ROW LEVEL SECURITY;

-- Workspaces
CREATE POLICY "workspaces_own" ON workspaces
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Projects
CREATE POLICY "projects_own" ON projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Milestones
CREATE POLICY "milestones_own" ON milestones
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tasks
CREATE POLICY "tasks_own" ON tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Agents
CREATE POLICY "agents_own" ON agents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Thread Messages
CREATE POLICY "thread_messages_own" ON thread_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notifications
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Outputs
CREATE POLICY "outputs_own" ON outputs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKET — for agent-generated file outputs
-- Run this separately in your Supabase dashboard or Storage API
-- ─────────────────────────────────────────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('agent-outputs', 'agent-outputs', false);

-- CREATE POLICY "outputs_storage_own" ON storage.objects
--   FOR ALL USING (
--     bucket_id = 'agent-outputs' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME — enable real-time subscriptions for notifications
-- ─────────────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE thread_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE agents;
