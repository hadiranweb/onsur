# ADR 0008 — Knowledge governance and version proposals

- Status: accepted
- Sprint: 08
- Date: 2026-08-13

## Context

Sprint 08 converts supported evidence into governed, versioned knowledge and
change proposals. No automatic canonical merge; no NELM.

## Decision

### Knowledge

- `Knowledge` is workspace-scoped and owner-attributed (raw user data private
  by default), versioned `(id, version)`, and carries `evidenceRefs`.
- Lifecycle `draft → published → superseded` (pure transitions). Published
  knowledge is immutable: evolution creates a new version and supersedes the
  prior one.

### VersionProposal

- A proposal targets a knowledge/process/island record with `fromVersion`,
  `toVersion` (strictly forward), `rationale`, optional `content` (knowledge),
  and `evidenceRefs`. Feedback/evaluation from a Run may be referenced as
  evidence.
- Review lifecycle `proposed → under_review → approved → merged` (or rejected);
  merge requires approval and a forward version. There is no automatic merge.
- For process/island targets the proposal must advance exactly one patch
  version (`isNextPatch`), and merge produces a new draft version preserving
  the prior one.

### Prior-version preservation and provenance

- Every new version is a new row; the prior version is superseded, never
  mutated. `provenance.derivedFrom` links the new version back to the prior
  version and the proposal's evidence.

## Consequences

- Knowledge changes are traceable: proposal → approval → new version, with the
  prior version and provenance intact.
- Skill version proposals are deferred to the Asset Registry (Sprint 11), where
  `skill` is an asset kind.
