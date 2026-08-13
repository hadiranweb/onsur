# ADR 0007 — Evidence, feedback, and scoped memory

- Status: accepted
- Sprint: 07
- Date: 2026-08-13

## Context

Sprint 07 closes the first learning loop: evidence intake with a quality gate,
feedback tracing to runs, and scoped memory — without automatic canonical
mutation. Casio-plus-mcp patterns were reviewed conceptually; behavior is
ported into Element Plus contracts, not copied.

## Decision

### Evidence

- `EvidenceService.intake` computes a deterministic SHA-256 fingerprint and
  stores evidence workspace-scoped at status `intake`.
- `submit` enforces a **quality gate** (substantive content + fingerprint) via
  `evaluateEvidenceQuality` (pure, in the domain layer); evidence failing the
  gate cannot reach review, so it cannot be accepted.
- Duplicate detection is two-tiered: exact by fingerprint, approximate by
  normalized-token Jaccard similarity (default threshold 0.8), both scoped to
  the workspace. Rejected evidence is terminal (never promotes).

### Feedback

- Feedback always traces to its originating Run (`runId` + `derivedFrom`
  provenance). Submission is authorized: only a member of the run's workspace
  may submit feedback.
- Lifecycle `submitted → triaged → accepted → applied` (or rejected).
- `apply` converts the feedback content into a workspace-scoped
  **MemoryCandidate** (`Run → Feedback → MemoryCandidate`).

### Memory

- `MemoryEntry` is scoped: `private` (owner only), `workspace` (members),
  `shared` (members write, any authenticated user reads). Authorization is a
  pure function (`canReadMemory` / `canWriteMemory`) enforced server-side.
- Runtime memory output (e.g. OpenClaw `memoryCandidates`) is ingested by the
  run engine as `candidate` entries only; promotion is an explicit, authorized
  step. Cross-workspace retrieval of workspace-scoped memory is denied.

## Consequences

- No automatic canonical mutation: runtime output and applied feedback both
  stop at `candidate`; promotion requires an authorized human decision.
- Evidence, feedback, and memory each carry provenance throughout.
