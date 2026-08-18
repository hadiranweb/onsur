-- Feedback: user feedback that traces to its originating run. Status
-- transitions submitted -> triaged -> accepted|rejected, accepted -> applied.
CREATE TABLE feedback (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  content text NOT NULL,
  status text NOT NULL CHECK (status IN ('submitted', 'triaged', 'accepted', 'rejected', 'applied')),
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feedback_run_idx ON feedback (run_id);
