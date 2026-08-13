-- Version proposals: governed evolution signals for knowledge, processes, and
-- islands. Lifecycle draft -> proposed -> under_review -> approved -> merged
-- (or rejected). No automatic canonical merge.
CREATE TABLE version_proposals (
  id text PRIMARY KEY,
  target jsonb NOT NULL,
  from_version text NOT NULL,
  to_version text NOT NULL,
  rationale text NOT NULL,
  content text,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (
    status IN ('draft', 'proposed', 'under_review', 'approved', 'rejected', 'merged')
  ),
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX version_proposals_target_idx ON version_proposals ((target->>'id'));
