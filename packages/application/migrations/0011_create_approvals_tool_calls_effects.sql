-- Tool calls, approvals, and effect records.
--
-- Tool calls record every attempt to execute a tool (even denied ones).
-- Approvals gate irreversible/external effects (default deny). Effect records
-- capture external effects that actually occurred; a rejected approval never
-- produces an effect record.
CREATE TABLE tool_calls (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tool_id text NOT NULL,
  tool_name text NOT NULL,
  arguments jsonb NOT NULL,
  effect_kind text NOT NULL CHECK (effect_kind IN ('read_only', 'external_reversible', 'external_irreversible')),
  requires_approval boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('requested', 'approved', 'rejected', 'denied', 'executed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tool_calls_run_idx ON tool_calls (run_id);

CREATE TABLE approvals (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tool_call_id text NOT NULL REFERENCES tool_calls(id) ON DELETE CASCADE,
  effect_kind text NOT NULL CHECK (effect_kind IN ('read_only', 'external_reversible', 'external_irreversible')),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by text
);

CREATE INDEX approvals_run_idx ON approvals (run_id);

CREATE TABLE effect_records (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  tool_call_id text NOT NULL REFERENCES tool_calls(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('read_only', 'external_reversible', 'external_irreversible')),
  description text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reverted boolean NOT NULL DEFAULT false
);

CREATE INDEX effect_records_run_idx ON effect_records (run_id);
