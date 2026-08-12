# ADR 0005 — Run engine and fake runtime

- Status: accepted
- Sprint: 05
- Date: 2026-08-13

## Context

Sprint 05 must prove execution semantics independently of OpenClaw: a
RuntimeAdapter interface, a fake adapter, and a run engine that enforces the
approval semantics for irreversible external effects.

## Decision

### RuntimeAdapter is a port; OpenClaw is one implementation

`RuntimeAdapter` (`packages/application/src/ports.ts`) is the only runtime
contract. `FakeRuntimeAdapter` (Sprint 05) and OpenClaw (Sprint 06) implement
it. The run engine never talks to a runtime except through this interface, so
approval semantics are identical regardless of adapter.

### Every tool execution passes through a ToolGate (default deny)

The engine injects a `ToolGate` into the adapter. Before an effectful tool
executes, the adapter awaits `gate.request(...)`. The gate:

- resolves the tool contract from the `ToolRegistry` (unknown tool ⇒ deny),
- records a ToolCall,
- for approval-requiring effects, creates a pending Approval, transitions the
  run to `awaiting_approval`, and waits for a decision,
- `approved` ⇒ grant (tool executes; EffectRecord created on result),
- `rejected` ⇒ deny (tool never executes; decision recorded on the timeline),
- `cancelled` ⇒ deny and the run ends cancelled.

### Background execution

`enqueue` persists the run, transitions draft→queued, and schedules in-process
asynchronous execution (detached promise). Decisions (`decideApproval`,
`cancel`) resolve an in-memory waiter; the state is persisted so any process
can observe it. A PostgreSQL-backed outbox/job replaces this in Sprint 09; the
in-memory waiter is noted as a single-process limitation.

### Immutable snapshots and the event timeline

The run `snapshot` (problemSpec/island/process refs + createdAt) is captured at
enqueue and never mutated. Every transition appends to `run_events` (seq-ordered
timeline), so the full decision history — including rejections — is traceable.

### Permission gate is pure

`requiresApproval` / `isToolExecutionAuthorized` live in the domain layer:
irreversible always requires approval; otherwise the contract flag decides.
This is unit-tested independently of the engine.

## Consequences

- The critical scenario (irreversible effect ⇒ pause ⇒ reject ⇒ tool never
  executes ⇒ trace records the decision) is proven by unit and integration
  tests; the happy-path Structured Analysis run is live-verified over HTTP.
- Rejection/cancellation correctness does not depend on OpenClaw at all.
