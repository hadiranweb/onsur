# ADR 0006 — OpenClaw adapter (RuntimeAdapter via the documented CLI)

- Status: accepted
- Sprint: 06
- Date: 2026-08-13

## Context

Sprint 06 requires executing an Element Plus Run through OpenClaw while
preserving Element Plus boundaries, and explicitly forbids inventing
undocumented endpoints. OpenClaw (`openclaw@2026.7.1-2`, "Multi-channel AI
gateway with extensible messaging integrations") was inspected in this
environment: it is not installed and no credentials are present.

## Decision

### Ground the adapter in the documented CLI, not internal APIs

Inspection of the shipped package showed two stable external surfaces:

1. the **CLI** (`openclaw agent`, `openclaw sessions`, `openclaw health`,
   `openclaw approvals`, `openclaw memory`), and
2. the **plugin SDK** (for plugins running _inside_ OpenClaw).

The `runEmbeddedAgent` / `EmbeddedRunAttemptParams` types are low-level
harness internals (auth stores, runtime plans, context engines), not a stable
contract for an external orchestrator. Therefore the adapter shells out to the
**documented CLI** using only documented flags:

- `openclaw agent --agent <id> --session-key <key> --message-file <path>
--timeout <seconds> --json [--local]`
- `openclaw health --json --timeout <ms>`

### Mapping rules (implemented and contract-tested)

- **run/session mapping**: OpenClaw session key is derived as
  `agent:<agentId>:element-plus-<runId>` — explicitly distinct from the
  Element Plus `run_id` (`assertDistinctSessionKey` enforces the invariant).
- **context mapping**: the ProblemSpecification (structured understanding,
  raw problem, evidence/assumptions/unknowns, success criteria, constraints)
  is rendered into the `--message-file` passed to OpenClaw.
- **tool-grant mapping / authorization**: OpenClaw permissions can never
  expand Element Plus authority. The adapter never executes an effectful tool;
  the Element Plus ToolGate remains the only execution path, and OpenClaw runs
  under its own default-deny exec posture. Effectful steps in the OpenClaw
  prompt are declared out of scope for the runtime.
- **tool interception**: OpenClaw stderr diagnostics stream as Element Plus
  `log` events; no effectful tool result is accepted from OpenClaw.
- **event/result/artifact mapping**: documented `--json` response fields
  (`payloads[].text`, `meta.transport`, `status: in_flight`) are normalized to
  `completed` / `failed` events and a result artifact.
- **error normalization**: non-zero exit, `in_flight`, non-JSON, and missing
  binary are normalized to stable `RuntimeError` codes
  (`OPENCLAW_ERROR`, `OPENCLAW_IN_FLIGHT`, `OPENCLAW_INVALID_JSON`,
  `OPENCLAW_NOT_CONFIGURED`).
- **cancellation**: cancelling a run aborts the adapter via `AbortSignal`
  (SIGTERM then SIGKILL on the child), matching OpenClaw's documented abort
  semantics.
- **memory output as candidate only**: any "Memory" section in the reply is
  surfaced as `memoryCandidates` on the result — it never mutates canonical
  memory or knowledge (promotion is governed in Sprint 07).

### Health

`checkOpenClawHealth` runs the documented `openclaw health` probe and reports
`connected` / `error` / `not_configured` — a configured binary or secret is
never reported as `connected`.

## Test stance

- **Contract tests PASS** against a fake `openclaw` binary emitting the
  documented JSON shape (15 tests: session mapping, context rendering, result /
  error / in_flight normalization, cancellation wiring, health, memory-candidate
  classification).
- **Live integration: NOT RUN** — no OpenClaw binary or credentials in this
  environment. A live verification requires an `openclaw` binary reachable via
  `OPENCLAW_BIN` (or PATH) plus configured providers; it is explicitly not
  claimed here.

## Consequences

- The adapter is safe to run even when OpenClaw is absent: runs fail with
  `OPENCLAW_NOT_CONFIGURED` rather than executing anything.
- No OpenClaw internals are depended upon, so a future OpenClaw version that
  keeps the documented CLI is compatible without code changes.
