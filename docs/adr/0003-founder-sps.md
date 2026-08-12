# ADR 0003 — Founder, SPS state machine, and the structured LLM port

- Status: accepted
- Sprint: 03
- Date: 2026-08-13

## Context

Sprint 03 turns a raw problem into a confirmed, versioned
`ProblemSpecification` through a Founder flow. Model output is untrusted until
schema validation; there is no real model provider yet.

## Decision

### SPS state machine (pure, deterministic)

Sessions advance `open → structuring → review → confirmed` with the events
`submit`, `produced`, `correct`, `confirm`, `fail`. The transition table lives
in `packages/domain/src/rules/sps.ts`; `confirmed` is terminal, so a confirmed
ProblemSpecification is never silently mutated — corrections happen before
confirmation, and later changes would be new sessions or proposals.

### ProblemSpecification versioning

- The first draft is `1.0.0`; each correction round produces the next patch
  version (`bumpPatch`), and prior drafts are preserved (never overwritten).
- Confirmation freezes the latest draft as `confirmed`. "Latest" is defined by
  semver version, not insert time (deterministic under ties).

### Structured LLM port

- `StructuredLlmPort` is an interface in `packages/application`; its output is
  schema-validated against `structuredProblemOutputSchema` before it can become
  a ProblemSpecification. Invalid output is rejected (`MODEL_OUTPUT_INVALID`).
- The default provider is `FakeStructuredLlm` — a deterministic transformer
  that separates evidence / assumption / unknown and derives success criteria.
  It is NOT intelligence; it exists to exercise the contracts until a real
  provider is integrated. `createAppServices` accepts an override.

### Workspace scoping

Founder sessions belong to a workspace and every operation is authorized via
`WorkspaceService.assertAccess` (default deny). The current web UX scopes
Founder to the user's personal workspace; team-workspace Founder arrives with
multi-workspace UX.

## Consequences

- The Founder flow is fully testable and live-verifiable with no external
  model dependency.
- A real model provider can be swapped in behind `StructuredLlmPort` without
  changing the state machine, persistence, or authorization.
- Crash atomicity of the multi-write Founder steps is deferred to the
  transactional outbox (Sprint 09), as noted for Sprint 02.
