-- Capabilities: named, versioned units of reusable ability (the Capability
-- Registry). One identity (`id`) can have multiple versions; names are unique
-- per capability identity.
CREATE TABLE capabilities (
  id text NOT NULL,
  version text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);

CREATE INDEX capabilities_name_idx ON capabilities (name);
