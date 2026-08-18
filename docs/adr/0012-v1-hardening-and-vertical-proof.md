# ADR 0012 — v1 hardening and the complete vertical proof

- Status: accepted
- Sprint: 12
- Date: 2026-08-13

## Context

Sprint 12 hardens v1 and proves the complete vertical chain. It also defines
the E2E stance, because OpenClaw is not live in this environment.

## Decision

### Run recovery

`RunEngine.recoverStaleRuns` marks stale non-terminal runs terminal (cancel for
queued/awaiting, fail for running), rejects their pending approvals, and is
invoked once on web startup. This prevents a crash from leaving runs stuck
awaiting approval indefinitely.

### Logging

A minimal structured JSON logger (`util/logger.ts`) with `LOG_LEVEL` control;
no secrets are logged.

### E2E stance (honest)

Two layers of E2E:

1. **Vertical E2E as a permanent test** (`vertical-e2e.test.ts`): drives the
   full v1 chain through `createAppServices` against real PostgreSQL — new user
   → workspace → Founder → confirmed spec → capability/island → process → run
   (**fake runtime**) → approval → result → evaluation → feedback → memory →
   proposal → governed version change → asset publication → second-workspace
   fork + exact-version install.
2. **HTTP-level E2E script** (`pnpm e2e:vertical`): black-box over the Next.js
   API surface.

OpenClaw live execution is explicitly **NOT RUN** (no binary/credentials); the
run step in the E2E uses the fake runtime, and OpenClaw remains contract-tested
only (Sprint 06).

### Documentation

`docs/v1-architecture.md` (map, tree, schema, API, test inventories, limitations,
deferred v2), `docs/security.md` (checklist with mechanisms + evidence),
`docs/operations.md` (migrations, backups, jobs, run recovery, logging, health).

## Consequences

- The full vertical is repeatable in CI (`pnpm test`) and over HTTP
  (`pnpm e2e:vertical`).
- Browser-level (Playwright) E2E is deferred to v2 (browser binaries not
  installed); documented, not claimed.
