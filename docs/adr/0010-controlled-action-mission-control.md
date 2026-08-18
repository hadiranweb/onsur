# ADR 0010 — Controlled Action Island and Mission Control

- Status: accepted
- Sprint: 10
- Date: 2026-08-13

## Context

Sprint 10 proves a real externally effectful Island and provides operational
UX. Selective UX inspiration from FounderOS is allowed, but its domain model is
not imported.

## Decision

### Controlled Action Island (config-driven fake script)

- `controlledActionIslandManifest` declares capability "Controlled Action" and
  a `fake` runtime binding whose `config.script` requests `tool-write-file`
  (an `external_reversible` effect).
- The run engine's default runtime factory parses `runtime.config.script`
  (`parseFakeScript`) and drives the same ToolGate handshake as any real
  runtime: the run pauses (`awaiting_approval`), the effect executes only on
  approval, and the decision + effect are recorded on the timeline.

### Mission Control (`/app`)

- One operational surface: pending approvals (what will happen, per effect),
  active runs, recent results, active islands (runtime binding), honest
  connector status (relay + OpenClaw), and workspace summary.
- The run detail page shows "what will happen" (tool name + arguments +
  effectKind) before approve/reject, and the complete timeline, tool calls,
  effects, artifacts, evaluations, and feedback afterwards.

### Honesty

- Connector status is a live probe result (never inferred from a secret).
- The fake runtime is presented as in-process/fake, not as a live external
  runtime.

## Consequences

- The full approval loop is observable end-to-end: reject ⇒ tool never
  executes (no EffectRecord); approve ⇒ external_reversible EffectRecord plus
  `request_approval`/`approve` timeline events. Live-verified over HTTP.
