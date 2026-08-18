-- Islands: versioned, deployable units binding capabilities to a runtime via
-- a runtime binding. Status transitions draft -> candidate -> active ->
-- retired; an active version is never silently mutated.
CREATE TABLE islands (
  id text NOT NULL,
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'candidate', 'active', 'retired')),
  name text NOT NULL,
  description text NOT NULL,
  capabilities jsonb NOT NULL,
  runtime jsonb NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);
