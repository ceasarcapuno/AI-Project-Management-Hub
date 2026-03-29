-- 004_api_keys.sql — Persistent API keys for programmatic access (Maximus/OpenClaw)
CREATE TABLE IF NOT EXISTS api_keys (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  key_hash    VARCHAR(255) NOT NULL UNIQUE,  -- bcrypt hash of the key
  key_prefix  VARCHAR(12)  NOT NULL,         -- first 8 chars for display (e.g. aipm_a1b2)
  last_used   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys(key_hash);
