# V1 Verification / Forensic Audit — `40ffb97`

- **Audited ref:** `arena/019ff7e2-onsur` @ `40ffb97ef6a252f2e02802f4c5498f974267cc2e`
- **Mode:** READ/VERIFY only. No implementation code was modified, refactored, or "fixed". The only tree change produced by this audit is this document.
- **Date:** 2026-08-13
- **Method:** independent re-execution of the repository's own validation gate from a clean dependency state, black-box HTTP negative tests against a fresh PostgreSQL, and source-level inspection of the checked-out tree.

> Scope note on process: the audit requested is a *technical* verification of what exists at `40ffb97`. The git record shows a linear, single-parent series of 13 sprint commits (Sprint 00→12), each reachable from the head, with no history rewrite. Whether sprint-gate approval was observed between sprints is a process question that is **not determinable from the repository artifacts**; this document therefore reports only code-level facts.

---

## 1. Git state

| Item | Result |
|---|---|
| Repository full name | `hadiranweb/onsur` |
| Branch | `arena/019ff7e2-onsur` (current, checked out) |
| Local HEAD | `40ffb97ef6a252f2e02802f4c5498f974267cc2e` |
| Remote HEAD | `40ffb97ef6a252f2e02802f4c5498f974267cc2e` (identical) |
| Working tree | **clean** (0 modified/untracked after re-pointing to remote) |
| Commit count | 14 total (1 "Initial commit" + 13 sprint commits) |
| History rewritten? | **No.** First-parent chain == full graph (linear, no merges, no amended/force-pushed divergence detectable). |

Commit graph (all reachable from `40ffb97`):

```
40ffb97 sprint(12): v1 hardening and complete vertical proof
1439c4c sprint(11): asset registry and marketplace
bfd0901 sprint(10): controlled action island and mission control
d1b0fd2 sprint(09): package protocol, outbox, and connectors
46a3df9 sprint(08): knowledge governance and evolution
d485f5a sprint(07): evidence, feedback, and scoped memory
cb87fcb sprint(06): openclaw runtime adapter
e1a963a sprint(05): run engine and fake runtime
99d6405 sprint(04): capability, process, and island registries
f9d5a2e sprint(03): founder and structured problem solving
ad00e78 sprint(02): postgres, identity, and workspace isolation
d92b20d sprint(01): canonical contracts and domain core
91659d7 sprint(00): clean repository foundation
5fe3913 Initial commit
```

Files changed per sprint (name-only count):

| Sprint | Commit | Files | Δ insertions |
|---|---|---|---|
| 00 | 91659d7 | 52 | +3392 |
| 01 | d92b20d | 37 | +2190 |
| 02 | ad00e78 | 56 | +3022 |
| 03 | f9d5a2e | 31 | +1890 |
| 04 | 99d6405 | 29 | +1729 |
| 05 | e1a963a | 31 | +2566 |
| 06 | cb87fcb | 13 | +870 |
| 07 | d485f5a | 37 | +2131 |
| 08 | 46a3df9 | 25 | +1447 |
| 09 | d1b0fd2 | 22 | +1100 |
| 10 | bfd0901 | 13 | +573 |
| 11 | 1439c4c | 24 | +1477 |
| 12 | 40ffb97 | 14 | +1077 |

**Bulk/generated work:** none detected. Largest tracked file is `pnpm-lock.yaml` (80 KB); no binary blobs; no vendored dependency trees; no generated `dist/` committed (library "build" is `tsc --noEmit`). All 13 claimed sprint commits are reachable from `40ffb97`.

---

## 2. Repository inventory

- **Total tracked files:** 243.
- **LOC** (tracked, excluding lockfile/package.json/tsconfig):
  - TypeScript: **16,621**
  - TSX: **1,422**
  - JavaScript (`.mjs`): **633**
  - SQL (migrations): **407**
  - Markdown (docs): **1,117**
  - CSS: 205 · JSON (config, non-lock): 6 · YAML: 3

Package/workspace tree (pnpm workspace, `apps/*` + `packages/*`):

| Package | Purpose | Implemented code | Tests | Used by app? |
|---|---|---|---|---|
| `packages/contracts` | Canonical Zod schemas (domain language) | 18 schema files + env | 53 (4 files) | Yes (imported by domain/application/web) |
| `packages/domain` | Pure rules (no framework/runtime deps) | 16 rule modules under `rules/` | 104 (15 files) | Yes (imported by application) |
| `packages/application` | Services, ports, PostgreSQL adapters, outbox, OpenClaw adapter, fake runtime | 14 services + 10 infrastructure modules | 148 (12 files) | Yes (web depends on it) |
| `apps/web` | Next.js 14 app shell + HTTP API + UI | 17 pages + 30 API routes | 0 (no web unit tests) | — |

**Applications:** one (Next.js web). **Workers:** none as a separate process — background run execution is an in-process detached task inside the web process; outbox delivery is on-demand (`POST /api/outbox`), not a worker. **Adapters:** `FakeRuntimeAdapter`, `OpenClawRuntimeAdapter` (implements `RuntimeAdapter`); `RelayConnector` (implements `Connector`); `Postgres*Repository` classes (implement repository ports); `ScryptPasswordHasher`, `HmacSessionCodec`.

**Migrations:** 22 SQL files. **Docs:** 12 ADRs + `v1-architecture.md` + `security.md` + `operations.md`. **CI:** **absent from the committed tree** — `.github/workflows/` is listed in `.gitignore` (the local file no longer exists in this environment). See §16.

### Architecture-shaped placeholders (explicit detection)

- **All 14 domain "boundary" directories are empty placeholders.** `packages/domain/src/{identity,workspace,problem,sps,process,island,run,package,authority,evidence,memory,knowledge,provenance,assets}/index.ts` each contain only `export {}` (9 lines). The real domain logic lives in `packages/domain/src/rules/*.ts` and is re-exported from `domain/src/index.ts`. Functionally the domain rules ARE the domain core (used by the application), but the spec-named boundary *directories* are cosmetic.
- **`Agent` is schema-only.** `agentSchema`/`agentRoleSchema` exist; no repository, service, table, or runtime instantiation.
- **`AuditEvent` is schema-only.** `auditEventSchema`/`auditOutcomeSchema` exist; **no repository, no service, no migration, no table** (`audit_events` does not exist).
- **`Skill` is not an entity.** `skill` exists only as an `assetKind` value; there is no `skillSchema`.
- **`Context` has no canonical entity.** Context handling exists only as OpenClaw prompt rendering.
- **`apps/web` declares dead dependencies** — `pg` and `@element-plus/domain` are in its `package.json` `dependencies` but are imported **0 times** by web source.

---

## 3. Dependency boundaries (actual imports)

Domain (non-test source) imports — **verified by scanning actual `from '…'` statements**:

- `@element-plus/contracts` (12 occurrences) — **all `import type`** (a grep for non-`import type` contract imports returned **NONE**).
- Internal `./rules/*` and `./state-machine` only.
- **No** `next`, `react`, `react-dom`, `pg`/`postgres`, `openclaw`, `@anthropic-ai/sdk`, `openai`, or any DB driver.

Contracts imports: `zod` + internal schema modules only.

Application (non-test) external imports: `@element-plus/contracts` (23), `@element-plus/domain` (14), `pg` (6), `node:*` builtins. **No** Next.js/React/OpenClaw-npm/LLM SDK imports. The OpenClaw adapter shells out to the `openclaw` **CLI binary** via `node:child_process` (`spawn`), not an npm SDK.

Web imports: `@element-plus/application` (39), `@element-plus/contracts` (9), `next`, `react`, `react-dom`. **No direct `pg` import** (web talks to persistence only through application services).

**Boundary verdicts:**

- Domain free of Next/React/Postgres/OpenClaw/LLM: **TRUE** (verified at import level, plus the architecture guard test passes).
- apps → application, application → domain/contracts: **TRUE**.
- Adapters implement ports: **TRUE** (RuntimeAdapter/Connector/repository ports).
- UI is not the domain/persistence layer: **TRUE** (web has no direct `pg`; no direct `@element-plus/domain` import).
- OpenClaw types leaking into canonical contracts: **FALSE** (contracts has no OpenClaw types; the OpenClaw CLI wrapper is isolated under `packages/application/src/openclaw/`).

**Violations found:** none at the import level. (The only boundary smell is the *unused* `pg`/`domain` deps declared in `apps/web/package.json`, §2.)

---

## 4. Contracts and domain model

Classification key: IMPLEMENTED (schema + persistence + service path) · PARTIAL · SCHEMA_ONLY · PLACEHOLDER · ABSENT.

| Entity | Classification | Evidence |
|---|---|---|
| User | IMPLEMENTED | `identity.ts` schema; `users` table; `PostgresUserRepository`; `AuthService` |
| Workspace | IMPLEMENTED | schema; `workspaces` table; service; partial-unique personal index |
| Membership | IMPLEMENTED | schema; `workspace_memberships`; service |
| Problem | IMPLEMENTED | `problems` table; raw problem preserved verbatim |
| SPSSession | IMPLEMENTED | `sps_sessions` + `sps_messages`; `FounderService`; resumable via `get()` |
| ProblemSpecification | IMPLEMENTED | versioned `(problem_id, version)`; confirmed status |
| Evidence | IMPLEMENTED | `evidence` table; quality gate; fingerprint |
| Context | **ABSENT** | no canonical entity; only OpenClaw prompt rendering |
| Process | IMPLEMENTED | `processes` table; validate/publish/version |
| ProcessStep | IMPLEMENTED | part of Process; step validation |
| Island | IMPLEMENTED | `islands` table; manifest + lifecycle |
| Capability | IMPLEMENTED | `capabilities` table; registry service |
| RuntimeBinding | IMPLEMENTED | part of Island schema |
| Agent | **SCHEMA_ONLY** | schema + role enum; no repo/service/table |
| Tool | PARTIAL | `toolContractSchema`; in-memory seed registry (`DEFAULT_TOOL_CONTRACTS`); no persistence |
| Skill | **ABSENT** (as entity) | only `assetKind 'skill'` |
| Run | IMPLEMENTED | `runs` + `run_events`; state machine; engine |
| ToolCall | IMPLEMENTED | `tool_calls` table; recorded per gate request |
| Approval | IMPLEMENTED | `approvals` table; decide flow |
| Package | IMPLEMENTED | envelope schema; `outbox_messages` + `package_events` |
| Artifact | IMPLEMENTED | `artifacts` table; result persistence |
| Evaluation | IMPLEMENTED | `evaluations` table; only on completed runs |
| Feedback | IMPLEMENTED | `feedback` table; traces to Run |
| MemoryEntry | IMPLEMENTED | `memory_entries` table; scoped authz |
| Knowledge | IMPLEMENTED | `knowledge` table; versioned |
| VersionProposal | IMPLEMENTED | `version_proposals` table; review lifecycle |
| Asset | IMPLEMENTED | `assets` + `asset_installs`; publication gate |
| AuditEvent | **SCHEMA_ONLY** | schema only; **no table/service/repository** |

**Critical distinctions:**

- **Island != Agent / Process / Workspace / Service:** distinct schemas/tables (true). Note: Agent is unused (schema-only), so "Island != Agent" holds trivially in code.
- **Evidence != Memory != Knowledge:** distinct schemas/tables/services with no cross-mutation (true).
- **Run completion != evaluation success:** Evaluation is a separate entity, only allowed on `completed` runs, with verdict `pass|fail|needs_review` — a completed run is not auto-"successful" (true).
- **ToolResult != EffectRecord:** `tool_result` runtime events vs `effect_records` rows; EffectRecord is written only for `effectKind != read_only` (true).
- **Session != User identity:** `sessions.token_hash` maps to `user_id`; a session is never the user (true).

---

## 5. PostgreSQL and 22 migrations

All 22 migrations applied cleanly from **zero** on a fresh PGlite database (`Applied 22 migration(s) …`), and a second run reported `No pending migrations` (idempotent). No rollback files exist for any migration (forward-only, standard for this repo).

Resulting schema: **29 tables** (22 domain + `schema_migrations`), **23 foreign keys**, unique constraints on `users.email`, `sessions.token_hash`, `workspaces.slug`, `problem_specifications(problem_id,version)`, `sps_messages(session_id,seq)`, `run_events(run_id,seq)`, `connector_deliveries(connector_id,outbox_message_id)`; composite PKs `(id,version)` on capabilities/processes/islands/knowledge/assets; partial unique index `workspaces_one_personal_per_owner_idx` (one personal workspace per owner) — **verified present** in `pg_indexes`.

Per-migration inventory:

| # | Tables (types/indexes/constraints) | Used? |
|---|---|---|
| 0001 | users (email UNIQUE) | yes |
| 0002 | sessions (token_hash UNIQUE, FK users, user_id idx) | yes |
| 0003 | workspaces (slug UNIQUE, FK owner, partial personal-unique idx) | yes |
| 0004 | workspace_memberships (PK(ws,user), FKs, user idx) | yes |
| 0005 | problems, problem_specifications (UNIQUE(problem,version), workspace FK, idx) | yes |
| 0006 | sps_sessions, sps_messages (UNIQUE(session,seq), FKs, idx) | yes |
| 0007 | capabilities (PK(id,version), name idx) | yes |
| 0008 | processes (PK(id,version)) | yes |
| 0009 | islands (PK(id,version)) | yes |
| 0010 | runs, run_events (UNIQUE(run,seq), FK runs, idx) | yes |
| 0011 | tool_calls, approvals, effect_records (FKs runs/tool_calls, idx) | yes |
| 0012 | artifacts, evaluations (FK runs, idx) | yes |
| 0013 | evidence (workspace FK, idx) | yes |
| 0014 | feedback (run FK, idx) | yes |
| 0015 | memory_entries (workspace FK, owner/workspace idx) | yes |
| 0016 | knowledge (PK(id,version), workspace FK, idx) | yes |
| 0017 | version_proposals (target jsonb idx) | yes |
| 0018 | outbox_messages (pending partial idx) | yes |
| 0019 | package_events (correlation idx) | yes |
| 0020 | connector_deliveries (UNIQUE(connector,msg)) | yes |
| 0021 | assets (PK(id,version), public partial idx, owner idx) | yes |
| 0022 | asset_installs (workspace FK, idx) | yes |

Observations (not modified): `version_proposals.target`, `assets.owner`/`content_ref`, `outbox_messages.connector_id` are JSONB/string references without FK constraints (design choice). Workspace scoping columns exist on problems, sps, evidence, memory, knowledge, assets-installs — **but `runs` carries no `workspace_id` column**, which is the structural root of the run-authorization gap in §6.

---

## 6. Authentication and workspace isolation

Implementation verified (code + tests): scrypt password hashing (`ScryptPasswordHasher`, per-user salt, constant-time compare); server-side sessions (random 256-bit token, SHA-256 hash stored, HMAC-signed cookie); logout revocation; personal workspace creation (idempotent + partial unique index); default-deny `WorkspaceService.assertAccess`; membership model.

**Black-box negative tests re-executed against a fresh DB + running server:**

| Test | Expected | Actual |
|---|---|---|
| Unauthenticated mutation (`POST /api/workspaces`) | 401 | **401** ✓ |
| User B reads A's workspace detail | 404 (no leak) | **404** `{"error":"not_found"}` ✓ |
| Revoked session reuse (`/api/auth/session`) | 401 | **401** `{"user":null}` ✓ |
| **B enqueues a Run against A's confirmed spec** | **denied** | **303 → run `completed`** ✗ (cross-workspace ID substitution **succeeded**) |
| **B reads A's Run by ID** | denied | **HTTP 200** ✗ |
| **B cancels A's Run** | denied | **303 → A's run became `cancelled`** ✗ |

**Defect (critical):** the Run engine and run API routes perform **no workspace authorization**. `RunEngine.enqueue/get/list/cancel/decideApproval/evaluate` never consult the workspace of the ProblemSpecification, and `RunEngineDeps` does not even receive a `WorkspaceService`. Any authenticated user who knows (or enumerates) a confirmed spec id + active island id can enqueue, read, cancel, or approve/reject **another user's** runs. This is an IDOR-class authorization gap and it is **not covered by any test**.

The same class of check exists (and passes) for Founder, workspace detail, memory, feedback, and asset install/fork — so isolation is enforced at *most* service boundaries but **not** the run boundary.

---

## 7. Founder / SPS

Traced path `POST /api/founder/sessions → FounderService.start → problems + sps_sessions + sps_messages + problem_specifications → /app/founder/[id]`:

- Raw problem preserved verbatim: **verified** (stored on `problems.raw_problem` and carried into every spec version).
- SPS session persisted: **verified** (`sps_sessions` + `sps_messages`, seq-ordered).
- SPS resumable: **verified** (`FounderService.get` re-reads the persisted session/messages/draft/confirmed).
- Deterministic state machine: **verified** (`domain/rules/sps.ts` — `open→structuring→review→confirmed`; `confirmed` terminal).
- Model boundary: **verified** (`StructuredLlmPort`); default provider is `FakeStructuredLlm` (deterministic, explicitly not AI).
- Structured-output schema validation: **verified** (`structuredProblemOutputSchema`; malformed output rejected and never persisted — `MODEL_OUTPUT_INVALID`).
- Evidence/assumption/unknown separation + success criteria: **verified** (schema + fake LLM output + tests).
- User confirmation/correction: **verified** (confirm / correct routes; corrections bump the patch version, prior draft preserved).
- ProblemSpecification versioning: **verified** (`(problem_id, version)` unique; latest resolved by semver).

**Verdict:** Founder is a genuinely usable vertical slice (UI + API + persistence + state machine + tests), **with the caveat that the "AI" structuring step is a deterministic fake** (no real LLM provider is wired in).

---

## 8. Process / Island resolution

- Capability Registry: **verified** (service + repo + table).
- Process Registry: **verified** (service + validation + publish + versioning).
- Island Registry: **verified** (service + manifest + lifecycle + versioning).
- Compatibility search: **verified** (`domain/rules/island.ts` `resolveIsland` — provides all required capabilities, scored by overlap).
- Reuse-before-create: **verified** (`IslandService.resolveOrCreate`, `ensureReferenceIsland`, `ensureControlledActionIsland`).
- No-match creation: **verified** (draft island created).
- Island validation: **verified** (`islandManifestSchema` + `validateProcessSteps`).
- Activation gate: **verified** (`canActivateIsland` — must be runtime-bound; `runtime:none` rejected).
- Versioning: **verified** (`newVersion` bumps patch, prior preserved).
- Provenance → ProblemSpecification: **verified** (island `derivedFrom` accepts a `problem_specification` reference; covered by a test).

**Where AI vs deterministic logic:** the resolution path (ProblemSpecification → capability requirements → matching → Process → Island) is **100% deterministic** (pure functions + DB lookups). AI is only at the Founder structuring step (and it is a fake in practice).

---

## 9. Run engine

Traced path: `enqueue (draft→queued) → schedule → execute → start (queued→running) → RuntimeAdapter.start (async generator) → gate.request → [approval pause] → tool_result/effect → completed/failed → artifact → evaluation`.

- State transitions: **verified** (`runTransitions` table; terminal states completed/failed/cancelled; illegal transitions throw).
- Immutable snapshot: **verified** (snapshot captured once at enqueue; never mutated; only status/updated_at change).
- Failure: normalized to `{code,message}`, run → `failed` with `fail` event; runtime ending without terminal event → `RUNTIME_ENDED` fail.
- Cancellation: AbortController signals the adapter; awaiting-approval cancel rejects pending approvals and never executes the tool.
- Worker used or merely defined: **used** — the web process schedules in-process detached execution; the E2E and HTTP tests demonstrate real completion. However it is **single-process / in-memory** (approval waiter is a `Map`), with startup `recoverStaleRuns` as mitigation. There is **no multi-worker job queue**.
- **Authorization: absent** (§6). This is the run engine's principal defect.

---

## 10. Critical effect test (independently executed)

Reject path (black-box, `external_reversible` `tool-write-file` via Controlled Action Island):

- Run paused at `awaiting_approval`: **verified**.
- Effect had NOT executed at pause: **verified** (0 effect records).
- Reject approval → tool never executes: **verified** (`toolCall.status=rejected`, **0 EffectRecords**, `reject` timeline event).

Approve path:

- Approve → exactly one effect: **verified** (1 `external_reversible` EffectRecord, timeline `enqueue,start,request_approval,approve,complete`).
- Retry does not duplicate the effect: **verified** for the outbox/connector path (idempotent unique key); for tool effects, the engine records one EffectRecord per executed tool call (no retry path re-executes an already-executed tool call).

**Expectation gap — "Audit record exists":** **NOT MET.** There is no `audit_events` table or AuditEvent service; decisions are recorded as `run_events` (timeline) + `approvals` rows, which is traceable but is **not** the canonical `AuditEvent` entity (which is schema-only, §4).

---

## 11. OpenClaw adapter

- Interface: `OpenClawRuntimeAdapter implements RuntimeAdapter` (kind `openclaw`).
- Client: shells out to the `openclaw` **CLI binary** via `node:child_process` — documented flags `agent --agent --session-key --message-file --timeout --json [--local]` and `health --json --timeout`. **No npm SDK, no invented HTTP endpoints.** (The real `openclaw@2026.7.1-2` package was inspected during Sprint 06; its main entry is CLI/utilities, and `runEmbeddedAgent` was judged an internal harness API — documented in ADR 0006.)
- Health: `checkOpenClawHealth` (connected / error / not_configured) — honest, probe-based.
- Session mapping: `agent:<agentId>:element-plus-<runId>`; `assertDistinctSessionKey` enforces session key ≠ run id. **Verified: OpenClaw session id != run id.**
- Event/result/error mapping, cancellation (AbortSignal → SIGTERM/SIGKILL), memory-as-candidate (`classifyMemoryCandidates`): all present and contract-tested.
- OpenClaw cannot bypass Element Plus tool authority: **verified by construction** — the adapter never executes effectful tools; the Element Plus ToolGate is the only execution path.
- Runtime memory cannot become canonical Knowledge directly: **verified** — candidates are surfaced only; promotion is a separate governed path (§12).

**Classification: `CONTRACT_TESTED`** (15 tests against a fake `openclaw` binary that emits the documented JSON). **`LIVE_VERIFIED`: NO** (no OpenClaw binary/credentials in this environment). Not a stub — the adapter is complete code — but it is unproven against real OpenClaw.

---

## 12. Evidence / Memory / Knowledge

- Evidence intake → quality gate (`evaluateEvidenceQuality`) → fingerprint (SHA-256) → exact + approximate (normalized Jaccard) duplicate detection → accept/reject (rejected terminal): **verified** (service + tests). Statuses are `intake→pending_review→accepted|rejected` (no "quarantined" status — the gate rejects before review).
- Feedback → Run linkage → MemoryCandidate: **verified** (`submit` requires run-workspace membership; `apply` creates a workspace-scoped memory candidate with `sourceRun`).
- Memory scope (private/workspace/shared) + read/write authorization + cross-workspace isolation: **verified** (pure rules + service + tests; black-box cross-workspace retrieval denied).
- Knowledge: evidence-backed, versioned; VersionProposal review → approve/reject/merge; merge requires `approved` + forward version; prior version superseded (never mutated): **verified**.
- No silent automatic canonical merge: **verified** (merge is an explicit, authorized, status-gated step).

---

## 13. Package / Outbox

- Package types (`command|event|query|response|result|evidence`), `id`, `correlationId` (required), `causationId` (optional), `payload`, `provenance`, validation (`validatePackageCorrelation`): **verified**. (`source`/`destination` fields are **not** modeled — provenance carries `actor`/`source`; destinations are connector ids.)
- Transactional outbox: **verified** — `publish` writes `outbox_messages` + `package_events` in one transaction (`PgTransactionRunner`); a failing transaction rolls back both (unit-tested).
- Atomicity proven: **verified** (unit test asserts both writes roll back on transaction failure; integration test asserts both rows exist together).
- Worker delivery/retry: `deliverPending` with `FOR UPDATE SKIP LOCKED`, exponential backoff (cap 60s, 8 attempts), mark sent/failed. Trigger is on-demand (`POST /api/outbox`); no scheduler.
- Duplicate handling/idempotency: **verified** — `connector_deliveries` unique `(connector_id, outbox_message_id)`; integration test shows a duplicate retry does not duplicate the effect (count stays 1).

---

## 14. Asset Registry / Marketplace

- Register → publication gate (`canPublishAsset`) → publish → discover (`listPublic`/`search`) → install (exact version, idempotent) → fork (new identity + `derivedFrom` provenance): **verified** (service + tests + HTTP).
- Owner, provenance, visibility, license metadata, exact-version, fork lineage: **verified**.
- Private dataset cannot become public without rights metadata: **verified** (gate rejects; unit + integration).
- "Marketplace" surface: **real working UI + API** (`/app/marketplace`, `/app/assets`, `/app/assets/[id]` with publish/fork/install actions) — more than domain-only code, though version selection UI is absent (install uses latest).

---

## 15. UI claims

| Route | Classification | Basis |
|---|---|---|
| Login / Register | FUNCTIONAL | server-rendered forms + API, session cookie set, verified over HTTP |
| Home / Mission Control | FUNCTIONAL | aggregates pending approvals, active/recent runs, islands, connector status |
| Founder | FUNCTIONAL | start/correct/confirm flow + list + detail |
| Problems | **ABSENT** (no standalone page) | problems live inside Founder |
| Islands | FUNCTIONAL | list + detail + ensure-reference + create-draft |
| Run detail / timeline | FUNCTIONAL | timeline, tool calls, effects, artifacts, evaluations, feedback, approvals |
| Approvals | **PARTIAL** (no standalone page) | approvals surface on run detail + Mission Control |
| Memory | FUNCTIONAL | list + create + promote/reject |
| Assets | FUNCTIONAL | My Assets (owned/installed) + register form |
| Marketplace | FUNCTIONAL | catalog + search + publish/fork/install |
| Connections | FUNCTIONAL | connector status + outbox delivery pass |
| Settings | **ABSENT** | no settings page/route |

---

## 16. Clean-state validation (re-executed)

Commands and results (exit codes captured):

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | **PASS** (exit 0) |
| `pnpm format:check` | **PASS** |
| `pnpm lint` | **PASS** |
| `pnpm typecheck` | **PASS** (all 4 packages) |
| `pnpm test` | **PASS** — 305 tests, 31 files, **0 skipped** |
| `pnpm build` | **PASS** (Next.js production build) |
| `pnpm check:arch` | **PASS** |
| `pnpm e2e:vertical` | **PASS** (21 assertions, exit 0) |
| PostgreSQL integration tests | **PASS** (boot their own PGlite) |
| Permanent vertical test | **PASS** (`vertical-e2e.test.ts`) |
| Playwright | **NOT RUN** — no Playwright dependency/config exists in the repo; browser binaries absent |

Skipped/ignored tests: **none** (no `.skip`/`.todo`/`.only` anywhere).

---

## 17. Reconstructing the "305 tests" claim

`pnpm test` output: **contracts 53 + domain 104 + application 148 = 305**. No double counting (each package runs once; Vitest reports per-file counts that sum exactly).

Breakdown:

| Category | Count | Notes |
|---|---|---|
| Unit | 265 | contracts 53 + domain 104 + application unit 108 |
| Integration (real PostgreSQL via PGlite, real `pg` driver) | 25 | `postgres.integration.test.ts` (23) + `vertical-e2e.test.ts` (2) |
| Contract (fake `openclaw` CLI binary) | 15 | `openclaw-adapter.test.ts` |
| HTTP E2E script assertions | 21 | `pnpm e2e:vertical` — **separate**, not counted in the 305 |
| Skipped | 0 | verified |
| Mocked / fake-runtime | — | run-engine + vertical use `FakeRuntimeAdapter`; OpenClaw tests use a fake binary; DB is real (PGlite is real Postgres engine, not a mock) |
| Live external integration | 0 | nothing contacts a live external system (OpenClaw not live) |

**The "305 tests" claim is accurate.** The nuance is that 25 of them are integration (real DB) and 15 are fake-binary contract tests; the vertical's Run step is fake-runtime.

---

## 18. Vertical proof (transition classification)

Executed via `vertical-e2e.test.ts` (service-level, real DB) and `pnpm e2e:vertical` (HTTP, real DB):

| Arrow | Classification |
|---|---|
| User → auth | REAL_IMPLEMENTATION |
| auth → Workspace | REAL_IMPLEMENTATION |
| Workspace → Founder → Problem → SPS → ProblemSpecification | REAL_IMPLEMENTATION (structuring via **FAKE LLM**) |
| ProblemSpecification → capability resolution → Process → Island | REAL_IMPLEMENTATION (deterministic) |
| Island → Run → Runtime | **FAKE_RUNTIME** (reference/controlled islands bind `runtime:'fake'`) |
| Run → Result → Evaluation → Feedback → Memory | REAL_IMPLEMENTATION |
| Memory → VersionProposal → Knowledge version evolution | REAL_IMPLEMENTATION |
| Knowledge → Asset → second Workspace install/fork | REAL_IMPLEMENTATION |

OpenClaw Run: **NOT_IMPLEMENTED live** (adapter exists but is not exercised with a real runtime).

---

## 19. Security / data review

- Committed secrets / plaintext credentials: **none found** (secrets grep clean; only `.env.example` tracked, no values; test fixtures use `password123` etc.).
- Password handling: scrypt + per-user salt + constant-time verify; hash never returned (public user schema).
- Session handling: server-side, hashed token, HMAC cookie; revocation tested.
- Public mutation routes: all mutation routes require an authenticated session (`getSessionUser`); unauthenticated mutation → 401 (verified).
- **Missing workspace scope (IDOR):** Run engine + run routes (§6) — **the single most impactful defect**.
- Logs containing secrets: no (structured logger; startup recovery logs only counts/errors).
- Runtime bypass / approval bypass: tool gate is default-deny; approval required for irreversible; reject prevents execution (verified). No bypass found.
- Raw user data public by default: **false** (workspace-scoped at most boundaries; but the run-authorization gap leaks *execution* across workspaces, and run data is readable cross-workspace).
- Asset visibility mistakes: publication gate for datasets enforced; private install/fork restricted to owner.

---

## 20. Documentation truth audit

| Doc / claim | Classification | Basis |
|---|---|---|
| README roadmap "Sprint 00–12 done" | SUPPORTED (commit-level) | 13 sprint commits exist |
| README CI note ("authored locally … excluded") | **STALE** | `.github/workflows/` is gitignored AND the local file is absent in this environment |
| README validation gate incl. `e2e:vertical` | SUPPORTED | command passes |
| `docs/v1-architecture.md` invariant table ("default deny", "no external effect bypasses authorization") | **PARTIAL/CONTRADICTED** | true for the ToolGate, false at the Run boundary (no workspace authz) |
| `docs/security.md` "workspace isolation is enforced at every service boundary (`assertAccess`)" | **CONTRADICTED** | RunEngine + run routes do not use `assertAccess` (demonstrated empirically) |
| `docs/security.md` scrypt/session/password claims | SUPPORTED | code + tests |
| `docs/operations.md` migrations/backups/jobs/recovery/logging/health | SUPPORTED (backups are documented manual `pg_dump`, not a pipeline) |
| ADRs 0001–0012 | SUPPORTED (mostly) | ADR 0006's "no invented endpoints" is accurate; ADR 0005 notes single-process limitation accurately |
| "OpenClaw integrated" | **not claimed as live** (correct) | adapter is contract-tested only |
| "v1 completeness" (Sprint 12 report framing) | **OVERSTATED** | functional vertical works, but security completeness (run authz), AuditEvent, CI, and live OpenClaw are not done |

---

## 21. YAML traceability matrix

**Blocking fact:** the canonical Element Plus YAML was **never present** in the workspace, in the Git repository, or on any reachable path (re-verified: `find` for `*general*.yaml*`, `*spec*.yaml*`, and a content grep for `ProblemSpecification` across `*.yaml/*.yml` returned nothing). The only available "specification" is the implementation prompt's sprint list and its enumerated contract list. A true YAML-section traceability matrix **cannot be produced** — any matrix would trace against the prompt, not the YAML.

Against the prompt's enumerated contracts (the operative source of truth), the coverage is:

| Prompt requirement area | Classification | Evidence |
|---|---|---|
| Purpose / architectural boundaries | IMPLEMENTED | layering + guards |
| Domain model (identity…assets) | IMPLEMENTED except Agent/AuditEvent/Skill/Context (§4) | code + tables |
| Contracts | IMPLEMENTED | Zod schemas |
| Founder/SPS | IMPLEMENTED (fake LLM) | service + tests |
| Runtime / authority / security | PARTIAL | ToolGate complete; run-boundary authz missing |
| Run / effects | IMPLEMENTED | engine + EffectRecords |
| Memory / knowledge | IMPLEMENTED | scoped, governed |
| Evidence / quality | IMPLEMENTED | gate + fingerprints |
| Evaluation / feedback | IMPLEMENTED | entities + flows |
| Packages | IMPLEMENTED | envelope + outbox |
| Assets / marketplace | IMPLEMENTED | registry + gate + UI |
| Application services | IMPLEMENTED | 14 services |
| UX | SUBSTANTIALLY implemented (no Settings/Problems/standalone Approvals) | pages |
| APIs | IMPLEMENTED (30 routes) | verified |
| Jobs / persistence | PARTIAL (outbox on-demand, no scheduler) | code |
| Repository architecture | IMPLEMENTED | pnpm monorepo |
| OpenClaw | CONTRACT_TESTED (not live) | adapter + fake-binary tests |
| State machines | IMPLEMENTED | run/island/process/sps/evidence/feedback/proposal |
| End-to-end flows | IMPLEMENTED (fake runtime) | vertical test + HTTP E2E |
| Convergence v1 / invariants / acceptance matrix | PARTIAL (most invariants covered; run-boundary authorization + AuditEvent gaps) | tests |

---

## 22. Final classification

| Dimension | Rating |
|---|---|
| A. Architecture implementation coverage | **SUBSTANTIALLY_VERIFIED** |
| B. Functional vertical-slice coverage | **SUBSTANTIALLY_VERIFIED** (fake runtime) |
| C. Test evidence | **VERIFIED** (305 tests + HTTP E2E green; note the run-authz gap is untested) |
| D. Security enforcement | **PARTIAL** (strong auth/session/scope at most boundaries; **critical run-boundary IDOR**) |
| E. OpenClaw integration | **MINIMAL** (CONTRACT_TESTED, not live) |
| F. UI / product usability | **SUBSTANTIALLY_VERIFIED** (core flows usable; missing Settings/Problems/standalone Approvals) |
| G. Marketplace / asset implementation | **SUBSTANTIALLY_VERIFIED** |
| H. Operational / deployment readiness | **PARTIAL** (migrations/health/logging/recovery yes; **no CI in tree**, no scheduler, single-process, manual backups) |

Answers:

1. **Is 40ffb97 a coherent Element Plus v1 implementation?** Yes — it is a coherent, layered, well-tested implementation of the architecture. It is **not** a complete, releasable "v1" as of this commit.
2. **Genuinely working:** identity/sessions, workspaces + isolation (except runs), Founder/SPS (fake LLM), capability/process/island registries with reuse-before-create, run engine (fake runtime) with approval semantics, evidence/feedback/memory, knowledge governance, package protocol + outbox (idempotent), asset registry/marketplace, Mission Control UI — all persistent and exercised by tests and the HTTP E2E.
3. **Scaffolding:** the 14 empty domain boundary directories, `Agent` (schema-only), `AuditEvent` (schema-only), `Skill` (asset-kind only), `Context` (no entity), web dead deps (`pg`, `@element-plus/domain`), and CI (absent from tree).
4. **Overstated claims in the prior Sprint 12 report:** (a) "security … reviewed and documented with evidence" — overstated: the run-boundary workspace authorization gap was not detected; (b) `docs/security.md` "workspace isolation enforced at every service boundary" — contradicted; (c) "OpenClaw … not live" was reported honestly and remains correct; (d) "305 tests" and "E2E PASS" were accurate.
5. **Highest-impact implementation gaps:** (1) run engine/API workspace authorization (IDOR), (2) AuditEvent never persisted, (3) OpenClaw not live-verified, (4) CI absent from the repository, (5) no outbox scheduler (delivery is manual).
6. **Merge-readiness into `main`:** this is best characterized as a **developer alpha** (architecture prototype + working vertical slice with strong test evidence). It is **not** a product alpha and **not** a v1 release, because of the run-boundary authorization defect, the non-live OpenClaw integration, and the absence of CI.

---

*End of audit. No remediation recommendations are made here, per instruction.*
