-- Workspaces: isolation boundary for problems, runs, and knowledge. Each user
-- has at most one `personal` workspace (enforced by the partial unique index).
CREATE TABLE workspaces (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'team' CHECK (kind IN ('personal', 'team')),
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX workspaces_one_personal_per_owner_idx
  ON workspaces (owner_user_id)
  WHERE kind = 'personal';
