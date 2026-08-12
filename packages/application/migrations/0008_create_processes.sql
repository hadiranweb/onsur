-- Processes: reusable, versioned executable structures (steps). Status
-- transitions draft -> validated -> published -> superseded; a published
-- version is never silently mutated.
CREATE TABLE processes (
  id text NOT NULL,
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'validated', 'published', 'superseded')),
  title text NOT NULL,
  description text NOT NULL,
  steps jsonb NOT NULL,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);
