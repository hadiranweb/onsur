-- Asset installs: exact-version installations into a workspace.
CREATE TABLE asset_installs (
  id text PRIMARY KEY,
  asset_id text NOT NULL,
  version text NOT NULL,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  installed_by text NOT NULL,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX asset_installs_workspace_idx ON asset_installs (workspace_id);
