-- Users: identity accounts. Emails are stored lowercased (normalized at the
-- application boundary) and are unique. Password hashes are scrypt-encoded.
CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
