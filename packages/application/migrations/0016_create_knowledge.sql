-- Knowledge: governed, versioned, workspace-scoped, evidence-backed. Status
-- transitions draft -> published -> superseded; evolution is by new version
-- (prior versions preserved, never mutated).
CREATE TABLE knowledge (
  id text NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id text NOT NULL,
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published', 'superseded')),
  title text NOT NULL,
  content text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);

CREATE INDEX knowledge_workspace_idx ON knowledge (workspace_id);
