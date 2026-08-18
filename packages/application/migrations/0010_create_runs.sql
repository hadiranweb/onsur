-- Runs: immutable execution snapshots plus a status and a persisted event
-- timeline. The snapshot (problemSpec/island/process refs) is captured once at
-- enqueue time and never mutated; only status advances.
CREATE TABLE runs (
  id text PRIMARY KEY,
  status text NOT NULL CHECK (
    status IN ('draft', 'queued', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled')
  ),
  snapshot jsonb NOT NULL,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE run_events (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq bigint NOT NULL,
  type text NOT NULL CHECK (
    type IN ('enqueue', 'start', 'request_approval', 'approve', 'reject', 'complete', 'fail', 'cancel', 'log')
  ),
  at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (run_id, seq)
);

CREATE INDEX run_events_run_idx ON run_events (run_id);
