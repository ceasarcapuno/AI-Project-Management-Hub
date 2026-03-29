-- 004_api_keys.sql — Persistent API keys for programmatic access (Maximus/OpenClaw)
CREATE TABLE IF NOT EXISTS api_keys (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  name        VARCHAR(255) NOT NULL,
  key_hash    VARCHAR(255) NOT NULL UNIQUE,
  key_prefix  VARCHAR(12)  NOT NULL,
  last_used   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK separately so it is idempotent
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_user_id_fkey'
  ) THEN
    ALTER TABLE api_keys ADD CONSTRAINT api_keys_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_key_prefix_idx ON api_keys(key_prefix);
