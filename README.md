# Element Plus — عنصر پلاس

A structured problem-solving platform: turn a raw problem into a confirmed
`ProblemSpecification`, resolve it into reusable Processes and Islands, execute
Runs under strict authorization, and convert supported evidence into governed,
versioned knowledge.

> Repository note: this GitHub repository is named `onsur` (the transliteration
> of "عنصر", "element"). The **product name is "Element Plus" (عنصر پلاس)** and
> the npm scope is `@element-plus/*`.

## Status

- Sprint 00 (clean repository foundation): **in progress**
- Sprint 01+ (canonical contracts, identity, problem solving, run engine,
  knowledge governance, packages, marketplace, hardening): planned — see the
  sprint roadmap below.

## Architecture

Element Plus is layered. The Domain layer must not depend on Next.js, React,
PostgreSQL drivers, OpenClaw, or LLM/provider SDKs.

```
apps/web               Next.js web application (the only framework host)
packages/application   application services / orchestration
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

## Repository layout

```
apps/web/                  Next.js app (web shell, local health surface)
packages/domain/           pure domain boundaries (placeholder in Sprint 00)
packages/contracts/        canonical schemas + environment contract
packages/application/      application services (placeholder in Sprint 00)
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
pnpm dev          # start the web app (after `pnpm build` for libs, if needed)
```

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

## Environment

Copy `.env.example` to `.env.local` and fill in values. In Sprint 00/01 no
database or auth secret is required; `DATABASE_URL` and `AUTH_SECRET` become
required from Sprint 02 onward. The web health surface reports environment
validation status honestly (`ok` vs `degraded`).

## Sprint roadmap

| Sprint | Scope                                      | Status  |
| ------ | ------------------------------------------ | ------- |
| 00     | Clean foundation                           | current |
| 01     | Canonical contracts + domain core          | planned |
| 02     | PostgreSQL + identity + workspace          | planned |
| 03     | Founder + structured problem solving       | planned |
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
