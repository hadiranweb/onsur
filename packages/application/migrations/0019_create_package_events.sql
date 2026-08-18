-- Package events: the domain record of every emitted package. Written in the
-- same transaction as the outbox message (atomic).
CREATE TABLE package_events (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('command', 'event', 'query', 'response', 'result', 'evidence')),
  correlation_id text NOT NULL,
  causation_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX package_events_correlation_idx ON package_events (correlation_id);
