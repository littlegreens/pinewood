ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role varchar(30) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS blocked_at timestamp;

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_blocked_at ON users (blocked_at);

ALTER TABLE trails
  ADD COLUMN IF NOT EXISTS ai_enriched_at timestamp,
  ADD COLUMN IF NOT EXISTS ai_enrichment_version varchar(50);

CREATE INDEX IF NOT EXISTS idx_trails_ai_enriched_at ON trails (ai_enriched_at);
