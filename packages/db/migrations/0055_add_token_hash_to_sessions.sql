ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_unique_idx ON sessions (token_hash) WHERE token_hash IS NOT NULL;
