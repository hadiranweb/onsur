-- Problems: the raw user statement, preserved verbatim, scoped to a workspace.
CREATE TABLE problems (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  raw_problem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX problems_workspace_idx ON problems (workspace_id);

-- ProblemSpecifications: versioned structured understandings of a problem.
-- One row per (problem, version); confirmed versions are never silently
-- mutated (status transitions draft -> confirmed -> superseded only).
CREATE TABLE problem_specifications (
  id text PRIMARY KEY,
  problem_id text NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'confirmed', 'superseded')),
  raw_problem text NOT NULL,
  structured_understanding text NOT NULL,
  items jsonb NOT NULL,
  success_criteria jsonb NOT NULL,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (problem_id, version)
);

CREATE INDEX problem_specifications_problem_idx ON problem_specifications (problem_id);
