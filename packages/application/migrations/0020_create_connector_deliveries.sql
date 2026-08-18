-- Connector deliveries: the effect of delivering an outbox message through a
-- connector. Idempotent per (connector_id, outbox_message_id).
CREATE TABLE connector_deliveries (
  id text PRIMARY KEY,
  connector_id text NOT NULL,
  outbox_message_id text NOT NULL,
  correlation_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector_id, outbox_message_id)
);
