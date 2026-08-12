-- Sessions: server-side sessions keyed by the SHA-256 hash of a random,
-- per-session token. A revoked session is marked with `revoked_at`; the token
-- itself is never persisted (and never shared across users).
CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
