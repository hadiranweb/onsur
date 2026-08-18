-- Run artifacts and evaluations.
CREATE TABLE artifacts (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('result', 'log', 'output', 'memory_candidate')),
  mime_type text NOT NULL,
  size_bytes bigint,
  data jsonb NOT NULL,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX artifacts_run_idx ON artifacts (run_id);

CREATE TABLE evaluations (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  verdict text NOT NULL CHECK (verdict IN ('pass', 'fail', 'needs_review')),
  score double precision,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX evaluations_run_idx ON evaluations (run_id);
