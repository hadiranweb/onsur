# ADR 0013 — Capability-preserving resource authority for cross-workspace execution

- Status: accepted
- Sprint: R0 (remediation)
- Date: 2026-08-13

## Context

The v1 audit (`docs/audits/v1-verification-40ffb97.md`) demonstrated an
execution-boundary defect: an authenticated user in workspace B could enqueue,
read, and cancel a Run built from workspace A's private ProblemSpecification,
because `runs` carried no execution workspace and `RunEngine` enforced no
workspace authority.

## Decision

### The invariant is capability-preserving, not isolationist

Element Plus is a future network of users/workspaces/islands/processes/assets.
The security invariant is NOT "cross-workspace access is forbidden"; it is:

> cross-workspace access WITHOUT an explicit authorized relationship is
> forbidden.

Direct `workspace_id === actor_workspace` equality is used only as the simplest
"owned/local" case. A reusable authority seam preserves future legitimate
relationships (installed / shared / delegated / public / contractual).

### Explicit execution workspace on Run

- New migration `0023_add_runs_workspace_id.sql` adds `runs.workspace_id`
  (nullable), backfills from the only reliable existing relationship
  (`problem_specifications.workspace_id` via the run snapshot), and adds an
  index. Legacy rows that cannot be backfilled remain NULL and **fail closed**.
- New runs always set `workspace_id` (enforced in code).

### Reusable authority boundary

`ResourceAccessService` (application) + `rules/resource-access.ts` (pure
vocabulary) implement the chain
Actor → Acting Workspace → Resource → Ownership → Relationship → Action:

- `assertCanAccessSubject(actor, actingWorkspace, subject, action)`:
  actor membership in the acting workspace, then a subject-relationship
  resolution (default deny).
- v1 relationships: `owned` (workspace-scoped ProblemSpecification) and
  `network` (the intentionally global Process/Island registries).
- `assertCanAccessRun(actor, runId, action)`: authority derives from the Run's
  explicit execution workspace (membership), never from id possession.

### Child execution resources inherit through the Run

`run_events`, `tool_calls`, `approvals`, `effect_records`, `artifacts`,
`evaluations` have no direct external access path; every access traverses the
authorized Run, so they inherit the Run's authority (no redundant
`workspace_id` columns).

### Bounded, indexed authorization

Run access and list queries are indexed by `runs.workspace_id`; list operations
scope to the actor's memberships (bounded), never scanning the global network.

## Consequences

- The audit exploit fails closed: foreign Run create/read/cancel/approve is
  denied; no run, job, dispatch, or side effect is produced.
- Legitimate operation (authorized create/read/cancel/approve, worker
  execution, cancellation, asset install/fork) is preserved.
- Future cross-workspace relationships are an extension point inside
  `resolveSubjectRelationship`, not scattered `if` checks in routes.
