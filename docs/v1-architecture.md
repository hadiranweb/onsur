# Element Plus — v1 architecture map and inventory

Generated at the end of Sprint 12 (v1 hardening + complete vertical proof).

## Architecture map

```
apps/web (Next.js 14)            the only framework host
  app/                          pages: home, login, register, /app (Mission Control),
                                 founder, islands, runs, evidence, memory, knowledge,
                                 connections, marketplace, assets
  app/api/                      HTTP handlers (auth, workspaces, founder, islands,
                                 runs/approvals, evidence, feedback, memory, knowledge,
                                 proposals, connections, outbox, assets, health)
  lib/server/                   composition root, session auth, cookie helpers

packages/application             services + ports + PostgreSQL adapters
  services/                     auth, workspace, founder, capability, process, island,
                                 run-engine, evidence, feedback, memory, knowledge,
                                 version-proposal, package, asset
  infrastructure/               pg pool, repositories, outbox, tool registry, crypto,
                                 fake runtime, relay connector
  openclaw/                     RuntimeAdapter via the documented `openclaw` CLI
  reference-islands/            Structured Analysis + Controlled Action manifests
  migrations/                   22 versioned SQL migrations

packages/contracts              canonical Zod schemas (the domain language)

packages/domain                 pure rules — zero framework/runtime dependencies

scripts/                        check-architecture.mjs (dependency guard)
docs/adr/                       12 architecture decision records
```

Layer boundaries (enforced by `pnpm check:arch` + a domain architecture test):

- `domain` depends on `contracts` (types only); no Next.js/React/pg/OpenClaw/LLM SDKs.
- `application` depends on `domain` + `contracts`.
- `web` depends on all three.

## Repository tree (abridged)

```
.
├── apps/web/                 Next.js app + HTTP API + UI pages
├── packages/
│   ├── application/          services, ports, adapters, migrations, scripts
│   ├── contracts/            Zod schemas (ids, provenance, problem, sps, process,
│   │                         island, run, approval, evidence, memory, knowledge,
│   │                         asset, package, identity, env)
│   └── domain/               pure rules (state machines, version, immutability,
│                             workspace auth, authority gate, package correlation,
│                             evidence quality gate, memory scope, asset gate)
├── scripts/check-architecture.mjs
├── docs/{adr,v1-architecture.md,security.md,operations.md}
├── .github/workflows/ci.yml  (authored; excluded from git — see ADR 0001 note)
└── package.json / pnpm-workspace.yaml / tsconfig.base.json
```

## Schema / migration inventory

22 migrations in `packages/application/migrations/` (applied idempotently via
`schema_migrations`, each in its own transaction):

| #    | Tables                                       |
| ---- | -------------------------------------------- |
| 0001 | users                                        |
| 0002 | sessions                                     |
| 0003 | workspaces (+ partial unique personal index) |
| 0004 | workspace_memberships                        |
| 0005 | problems, problem_specifications             |
| 0006 | sps_sessions, sps_messages                   |
| 0007 | capabilities                                 |
| 0008 | processes                                    |
| 0009 | islands                                      |
| 0010 | runs, run_events                             |
| 0011 | tool_calls, approvals, effect_records        |
| 0012 | artifacts, evaluations                       |
| 0013 | evidence                                     |
| 0014 | feedback                                     |
| 0015 | memory_entries                               |
| 0016 | knowledge                                    |
| 0017 | version_proposals                            |
| 0018 | outbox_messages                              |
| 0019 | package_events                               |
| 0020 | connector_deliveries                         |
| 0021 | assets                                       |
| 0022 | asset_installs                               |

## API inventory

Auth: `POST /api/auth/{register,login,logout}`, `GET /api/auth/session`.
Workspaces: `GET/POST /api/workspaces`, `GET /api/workspaces/[id]`.
Founder: `POST /api/founder/sessions`, `POST /api/founder/sessions/[id]/{correct,confirm}`.
Islands: `GET/POST /api/islands`, `POST /api/islands/{resolve,controlled-action}`.
Runs: `GET/POST /api/runs`, `GET /api/runs/[id]`, `POST /api/runs/[id]/{cancel,evaluate}`,
`POST /api/runs/[id]/approvals/[approvalId]`.
Evidence: `GET/POST /api/evidence`, `POST /api/evidence/[id]`.
Feedback: `POST /api/feedback`.
Memory: `GET/POST /api/memory`, `POST /api/memory/[id]`.
Knowledge: `GET/POST /api/knowledge`, `POST /api/knowledge/[id]`.
Proposals: `POST /api/proposals`, `POST /api/proposals/[id]`.
Connections/outbox: `GET /api/connections`, `POST/PUT /api/outbox`.
Assets: `GET/POST /api/assets`, `POST /api/assets/[id]`.
Health: `GET /api/health` (db + openclaw + connectors, honest status).

## Test inventory

305 tests, all passing (`pnpm test`):

- contracts: 53 (schemas, env, identity, sps)
- domain: 104 (lifecycles, version, immutability, authority, evidence, memory,
  package correlation, asset gate, island resolution, architecture guard)
- application: 148 (auth, workspace, founder, registry, run-engine, learning,
  governance, package, asset, OpenClaw contract tests, Postgres integration,
  **vertical E2E**)

Integration tests boot a real PostgreSQL (PGlite over the wire protocol) and
run migrations; the HTTP-level E2E lives at `pnpm e2e:vertical`.

## Known limitations

- OpenClaw live execution is **NOT RUN** (no binary/credentials); the adapter is
  contract-tested against a fake `openclaw` binary (Sprint 06).
- The delivery job is on-demand (`POST /api/outbox`); no self-scheduling cron.
- Background run execution is an in-process detached task with an in-memory
  approval waiter (single-process); stale runs are recoverable via
  `recoverStaleRuns` (wired into web startup).
- Registration (user + workspace + membership) is not yet a single transaction
  (outbox arrives for atomic multi-entity writes, but not applied to auth).
- `skill`/`template`/`knowledge_package`/`evaluation_pack` are asset types via
  the generic registry; no dedicated content models yet.
- Browser-level (Playwright) E2E is deferred (browser binaries not installed);
  the vertical is proven at service level (Vitest) and HTTP level (script).
- Founder UX is scoped to the personal workspace; team-workspace flows deferred.
- Agent records are not yet instantiated per run ("agent activity" = run timeline).

## Deferred to v2

- Playwright browser E2E; self-scheduling outbox worker; multi-workspace
  Founder/team flows; real LLM provider behind `StructuredLlmPort`; live
  OpenClaw verification; asset version selection UI; skill/template content
  types; per-run Agent records; payments/tokenomics (explicitly excluded).

## Invariant coverage evidence

| Invariant                                 | Covered by                                                          |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Domain free of framework/runtime imports  | `domain/src/__tests__/architecture.test.ts` + `check:arch`          |
| Island != Agent/Process/Workspace/Service | separate schemas/boundaries; island resolution tests                |
| OpenClaw is a RuntimeAdapter              | `OpenClawRuntimeAdapter implements RuntimeAdapter`; contract tests  |
| Default authorization is deny             | `domain/rules/workspace.ts`, `authority.ts` + service tests         |
| No external effect bypasses authorization | ToolGate + approval tests (reject → no effect)                      |
| Irreversible effects require approval     | `requiresApproval` + run-engine tests + vertical E2E                |
| Evidence != Memory != Knowledge           | separate schemas/repos/tables; no cross-mutation                    |
| Model output untrusted until validation   | `structuredProblemOutputSchema` + `MalformedStructuredLlm` test     |
| Published/versioned objects immutable     | `immutability` tests; version-preserving `newVersion` tests         |
| Raw user data private by default          | workspace scoping; cross-workspace denial tests                     |
| OpenClaw session_id != run_id             | `assertDistinctSessionKey` test                                     |
| OpenClaw memory candidate-only            | `classifyMemoryCandidates` + `ingestRunCandidates` (candidate) test |
| No automatic canonical merge              | proposal lifecycle; merge requires approved + forward               |
| Dataset not public without rights         | `canPublishAsset` + asset-service tests                             |
| Outbox atomic + idempotent delivery       | package-service + integration tests                                 |
| Workspace isolation                       | auth/workspace/learning/asset cross-workspace tests                 |
