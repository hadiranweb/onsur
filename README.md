# Element Plus — عنصر پلاس

A structured problem-solving platform: turn a raw problem into a confirmed
`ProblemSpecification`, resolve it into reusable Processes and Islands, execute
Runs under strict authorization, and convert supported evidence into governed,
versioned knowledge.

> Repository note: this GitHub repository is named `onsur` (the transliteration
> of "عنصر", "element"). The **product name is "Element Plus" (عنصر پلاس)** and
> the npm scope is `@element-plus/*`.

## Status

- Sprint 00 (clean repository foundation): **done**
- Sprint 01 (canonical contracts + domain core): **done**
- Sprint 02 (PostgreSQL + identity + workspace): **done**
- Sprint 03 (Founder + structured problem solving): **in progress**
- Sprint 04+ (capability/process/island, run engine, OpenClaw,
  evidence/memory/knowledge, packages, marketplace, hardening): planned — see
  the sprint roadmap below.

## Architecture

Element Plus is layered. The Domain layer must not depend on Next.js, React,
PostgreSQL drivers, OpenClaw, or LLM/provider SDKs.

```
apps/web               Next.js web application (the only framework host)
packages/application   application services / orchestration + persistence adapters
packages/contracts     canonical Zod schemas (the spec's domain language)
packages/domain        pure domain rules — no framework/runtime dependencies
```

Element Plus owns these domain boundaries: identity, workspace, problem, SPS,
process, island, run, package, authority, evidence, memory, knowledge,
provenance, assets.

Key non-negotiables (from the specification):

- Island != Agent, Island != Process, Island != Workspace, Island != Service.
- OpenClaw is a RuntimeAdapter, not Element Plus itself.
- Runtime implementations execute contracts; they do not redefine them.
- Default authorization is deny; no external effect may bypass authorization.
- Evidence != Memory != Knowledge.
- Model output is untrusted until schema validation.
- Published/versioned objects must not be silently mutated.
- Raw user data is private by default.

The dependency direction is enforced by `pnpm check:arch` and a domain
architecture test (see `docs/adr/0001-monorepo-and-layer-boundaries.md`).

### Identity + workspace (Sprint 02)

- Server-side sessions: a random per-session token is issued, only its SHA-256
  hash is persisted, and the cookie carries an HMAC-signed envelope
  (`AUTH_SECRET`). There is no shared token used as identity.
- Default-deny workspace authorization: a user with no membership (or a role
  below the required role) is denied; the decision core is pure (`domain`).
- Each user gets exactly one `personal` workspace, enforced by a partial unique
  index and idempotent creation.
- Passwords are scrypt-hashed (per-user salt, constant-time verify).

## Repository layout

```
apps/web/                  Next.js app: auth pages, authenticated shell, API
packages/domain/           pure domain rules + boundary placeholders
packages/contracts/        canonical schemas + environment contract
packages/application/      services, ports, PostgreSQL adapters, migrations
scripts/check-architecture.mjs
docs/adr/                  architecture decision records
```

> The CI workflow is authored locally at `.github/workflows/ci.yml` but
> temporarily excluded from git (the GitHub App currently lacks the `workflows`
> permission to push it). It will be restored once that permission is granted.

## Prerequisites

- Node.js >= 20
- pnpm 9 (see `packageManager` in `package.json`)

## Getting started

```bash
pnpm install
pnpm db:start      # boot a local PostgreSQL (PGlite over the wire protocol)
pnpm db:migrate    # apply versioned migrations (DATABASE_URL must be set)
pnpm dev           # start the web app
```

The local database is real PostgreSQL (PGlite, compiled to WASM) served over
the standard wire protocol on `127.0.0.1:5432`, so the app uses the ordinary
`pg` driver and `DATABASE_URL`. The same code runs against any hosted
PostgreSQL by pointing `DATABASE_URL` at it.

Open http://localhost:3000 and the health surface at
http://localhost:3000/api/health.

## Validation gate

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:arch
```

Integration tests (`packages/application/src/__tests__/postgres.integration.test.ts`)
boot their own in-process PostgreSQL and run automatically as part of
`pnpm test`; no external database is required.

## Environment

Copy `.env.example` to `.env.local` and fill in values. `DATABASE_URL` and
`AUTH_SECRET` are required from Sprint 02 onward. The health surface reports
environment validation and database connectivity honestly
(`connected | error | not_configured`).

## Sprint roadmap

| Sprint | Scope                                      | Status  |
| ------ | ------------------------------------------ | ------- |
| 00     | Clean foundation                           | done    |
| 01     | Canonical contracts + domain core          | done    |
| 02     | PostgreSQL + identity + workspace          | done    |
| 03     | Founder + structured problem solving       | current |
| 04     | Capability + process + island              | planned |
| 05     | Run engine + fake runtime                  | planned |
| 06     | OpenClaw adapter                           | planned |
| 07     | Evidence + feedback + memory               | planned |
| 08     | Knowledge governance + evolution           | planned |
| 09     | Package protocol + outbox + connectors     | planned |
| 10     | Controlled action island + mission control | planned |
| 11     | Asset registry + marketplace               | planned |
| 12     | v1 hardening + complete vertical proof     | planned |

## License

MIT — see [LICENSE](./LICENSE).
