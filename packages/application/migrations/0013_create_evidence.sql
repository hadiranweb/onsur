-- Evidence: workspace-scoped units of support with an exact content
-- fingerprint. Status transitions intake -> pending_review -> accepted|rejected.
CREATE TABLE evidence (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('evidence', 'assumption', 'unknown')),
  content text NOT NULL,
  fingerprint text NOT NULL,
  status text NOT NULL CHECK (status IN ('intake', 'pending_review', 'accepted', 'rejected')),
  source jsonb,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX evidence_workspace_idx ON evidence (workspace_id);
