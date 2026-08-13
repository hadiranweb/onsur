-- Memory entries: scoped, authorization-gated memory (private | workspace |
-- shared). Runtime output is only ever a `candidate`; promotion is an
-- authorized, explicit step.
CREATE TABLE memory_entries (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('private', 'workspace', 'shared')),
  content text NOT NULL,
  fingerprint text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_run jsonb,
  status text NOT NULL CHECK (status IN ('candidate', 'promoted', 'rejected')),
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX memory_entries_workspace_idx ON memory_entries (workspace_id);
CREATE INDEX memory_entries_owner_idx ON memory_entries (owner_id);
