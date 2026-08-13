-- Transactional outbox: persisted package messages delivered by a
-- database-backed job. Delivery is at-least-once; consumers are idempotent.
CREATE TABLE outbox_messages (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('command', 'event', 'query', 'response', 'result', 'evidence')),
  connector_id text NOT NULL,
  correlation_id text NOT NULL,
  causation_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbox_messages_pending_idx
  ON outbox_messages (status, available_at)
  WHERE status = 'pending';
