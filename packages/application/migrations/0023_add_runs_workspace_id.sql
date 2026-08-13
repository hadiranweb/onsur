-- R0 remediation: give every Run an explicit execution workspace.
--
-- New runs always set `workspace_id` (enforced in code). Historical rows are
-- backfilled from the only reliable existing relationship: the
-- ProblemSpecification recorded in the run snapshot owns a workspace. Rows
-- with no resolvable spec remain NULL and FAIL CLOSED at authorization time
-- (a NULL workspace grants no access).
ALTER TABLE runs ADD COLUMN workspace_id text;

UPDATE runs r
SET workspace_id = ps.workspace_id
FROM problem_specifications ps
WHERE ps.id = (r.snapshot->'problemSpec'->>'id')
  AND r.workspace_id IS NULL;

CREATE INDEX runs_workspace_idx ON runs (workspace_id);
