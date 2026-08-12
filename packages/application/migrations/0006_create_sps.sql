-- Structured Problem Solving sessions and their message timeline.
CREATE TABLE sps_sessions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  problem_id text NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'structuring', 'review', 'confirmed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sps_sessions_workspace_idx ON sps_sessions (workspace_id);

CREATE TABLE sps_messages (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES sps_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  seq bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, seq)
);

CREATE INDEX sps_messages_session_idx ON sps_messages (session_id);
