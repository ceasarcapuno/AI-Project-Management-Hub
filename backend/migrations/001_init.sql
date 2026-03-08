-- ─── AIPM Initial Schema ──────────────────────────────────────────────────────
-- Run via migrations/run.js on startup (idempotent — uses IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT CHECK (type IN ('private','business','work')) NOT NULL,
  label      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  emoji         TEXT,
  goal          TEXT,
  due_label     TEXT,
  cost          NUMERIC DEFAULT 0,
  token_used    INTEGER DEFAULT 0,
  token_limit   INTEGER DEFAULT 200000,
  needs_you     JSONB,
  employer_note TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milestones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  status     TEXT DEFAULT 'todo',
  position   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  status       TEXT DEFAULT 'todo',
  agent        TEXT,
  model        TEXT,
  position     INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT,
  model       TEXT,
  status      TEXT DEFAULT 'waiting',
  cost        NUMERIC DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,
  tasks_done  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS thread_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  from_type    TEXT NOT NULL,
  name         TEXT,
  avatar       TEXT,
  type         TEXT,
  label        TEXT,
  text         TEXT,
  bullets      JSONB,
  fields       JSONB,
  deliverables JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  level       TEXT DEFAULT 'info',
  read        BOOLEAN DEFAULT FALSE,
  title       TEXT NOT NULL,
  summary     TEXT,
  detail      TEXT,
  project     TEXT,
  agent       TEXT,
  actions     JSONB,
  token_used  INTEGER,
  token_limit INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outputs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
  agent      TEXT,
  filename   TEXT NOT NULL,
  filepath   TEXT NOT NULL,
  size_kb    INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
