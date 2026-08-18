# Architecture Guide

Element Plus is a layered monorepo for structured problem solving. The architecture separates the language of the domain from the services that execute it and from the framework that exposes it.

## Layer model

```text
┌──────────────────────────────────────────────────────────┐
│ apps/web — Next.js routes, UI, sessions and HTTP surface │
└───────────────────────────┬──────────────────────────────┘
                            │ calls application services
┌───────────────────────────▼──────────────────────────────┐
│ packages/application — use cases, ports, adapters         │
└───────────────────────────┬──────────────────────────────┘
                            │ applies domain decisions
┌───────────────────────────▼──────────────────────────────┐
│ packages/domain — pure rules and authority decisions      │
└───────────────────────────┬──────────────────────────────┘
                            │ validates shared vocabulary
┌───────────────────────────▼──────────────────────────────┐
│ packages/contracts — Zod schemas and boundary types      │
└──────────────────────────────────────────────────────────┘
```

`packages/contracts` defines canonical data shapes. `packages/domain` owns invariants and pure decisions. `packages/application` composes those decisions into use cases and isolates persistence or external runtimes behind ports. `apps/web` translates HTTP and UI concerns into application calls.

## Request and effect flow

A normal request should move through explicit boundaries:

```text
HTTP request
  → route/session validation
  → contract parsing
  → application use case
  → domain decision
  → authority resolution
  → persistence or external-effect port
  → validated result
  → HTTP response / UI projection
```

External effects are never dispatched merely because a request reached an application service. The application must resolve authority first, and the effect adapter must receive an explicit, capability-preserving decision. A denied or malformed request fails closed.

## Domain vocabulary

Element Plus models a structured problem-solving lifecycle through these boundaries:

| Boundary        | Responsibility                                                    |
| --------------- | ----------------------------------------------------------------- |
| Identity        | User identity, sessions and authentication state.                 |
| Workspace       | Tenant boundary and membership-based access.                      |
| Problem and SPS | A raw problem and its confirmed structured specification.         |
| Process         | Reusable steps and execution intent.                              |
| Island          | A bounded capability surface; it is not an agent or workflow.     |
| Run             | A concrete execution with authority, events and effects.          |
| Package         | Versioned, portable domain/application capability bundle.         |
| Evidence        | Observations and supporting material.                             |
| Memory          | Retained experience or feedback.                                  |
| Knowledge       | Governed reusable understanding derived from evidence and memory. |
| Provenance      | The lineage that explains how a record or decision was produced.  |
| Asset           | Registered files or other durable resources.                      |

## Invariants

The following rules are architectural constraints rather than UI conventions:

- An Island is not an Agent, Process, Workspace or Service.
- OpenClaw is a runtime adapter; it is not the Element Plus domain model.
- Authorization is deny-by-default and must precede protected external effects.
- Evidence, Memory and Knowledge have distinct meaning and lifecycle.
- Model output is untrusted until schema validation succeeds.
- Published and versioned objects are immutable; corrections produce new history.
- Raw user data is private by default and cross-workspace access must be resolved explicitly.
- Runtime adapters execute contracts and do not redefine domain semantics.

## Persistence and versioning

The application package owns persistence adapters and migrations. The domain package must not import the PostgreSQL driver. PostgreSQL-compatible local development is exposed through the standard wire protocol so application code uses the ordinary `pg` client; production can point `DATABASE_URL` at a hosted PostgreSQL service without changing the domain layer.

Versioned entities are treated as historical records. A new definition or published object is a new version, and supersession is explicit. This prevents silent rebinding of old evaluations, runs or evidence to new semantics.

## Authority model

Workspace membership and resource authority are evaluated through the application/domain boundary. A Run carries an explicit execution workspace; Run-related resources resolve authority through that owning Run. Future cross-workspace relationships must pass the authority resolver extension seam rather than bypassing the existing deny-by-default rule.

## Runtime integrations

Provider-specific integrations belong in application adapters. OpenClaw and other runtimes must consume canonical contracts, report structured outcomes and preserve uncertainty. A connector being configured does not imply that it is connected; status must come from an explicit probe or recorded lifecycle state.

## Architecture enforcement

Run the architecture guard when changing imports or package dependencies:

```bash
pnpm check:arch
```

The guard and the architecture tests are part of CI. If a feature cannot be implemented without violating the dependency direction, stop and document the proposed boundary change in an ADR before changing code.

## Related decisions

The detailed rationale is maintained in [ADR 0001](./adr/0001-monorepo-and-layer-boundaries.md), [ADR 0002](./adr/0002-identity-sessions-postgres.md), [ADR 0004](./adr/0004-capability-process-island-registries.md), [ADR 0005](./adr/0005-run-engine-fake-runtime.md), [ADR 0008](./adr/0008-knowledge-governance.md), [ADR 0010](./adr/0010-controlled-action-mission-control.md), [ADR 0012](./adr/0012-v1-hardening-and-vertical-proof.md) and [ADR 0013](./adr/0013-capability-preserving-resource-authority.md).
