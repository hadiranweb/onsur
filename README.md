# Element Plus — عنصر پلاس

[![CI](https://github.com/hadiranweb/onsur/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hadiranweb/onsur/actions/workflows/ci.yml)

Element Plus is a structured problem-solving platform. It turns a raw problem into a confirmed `ProblemSpecification`, resolves that specification into reusable Processes and Islands, executes Runs under explicit authority, and converts supported evidence into governed, versioned knowledge.

> **Repository and product names.** The GitHub repository is `onsur`, the transliteration of «عنصر». The product name is **Element Plus** (`عنصر پلاس`), and workspace packages use the `@element-plus/*` npm scope.

## Project status

The repository is in the v1 hardening phase. Sprints 00–11 are complete; Sprint 12 covers hardening, security review, and complete vertical proof. The current `main` branch is the canonical implementation branch, and every push to `main` or an `arena/**` branch is validated by GitHub Actions.

| Capability                                           | Current state    |
| ---------------------------------------------------- | ---------------- |
| Canonical contracts and domain rules                 | Implemented      |
| Identity, sessions, PostgreSQL and workspaces        | Implemented      |
| Founder, SPS, Process, Island and Run Engine         | Implemented      |
| Evidence, memory, knowledge governance and evolution | Implemented      |
| Packages, outbox, connectors and controlled actions  | Implemented      |
| Asset registry and marketplace                       | Implemented      |
| CI quality gates and production build                | Active on `main` |

## Architecture at a glance

Element Plus is a dependency-directed TypeScript monorepo. The Domain layer remains framework- and infrastructure-independent; application services orchestrate use cases; the web application is the framework host and delivery surface.

```text
apps/web               Next.js application, UI, API routes and runtime host
        ↓
packages/application   use cases, orchestration, ports, persistence and adapters
        ↓
packages/domain        pure domain rules and authorization decisions
        ↓
packages/contracts     canonical Zod schemas and shared boundary types
```

The dependency direction is enforced by `pnpm check:arch`. Runtime implementations execute contracts; they must not redefine them. The main domain boundaries are identity, workspace, problem, SPS, process, island, run, package, authority, evidence, memory, knowledge, provenance and assets.

The following invariants are intentionally strict:

| Invariant                                      | Meaning                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Island ≠ Agent ≠ Process ≠ Workspace ≠ Service | A capability boundary is not the same thing as an actor, workflow, tenant or implementation. |
| OpenClaw is an adapter                         | OpenClaw can execute a contract; it is not the platform’s domain model.                      |
| Authorization is deny-by-default               | External effects require an explicit authority decision before dispatch.                     |
| Evidence ≠ Memory ≠ Knowledge                  | Observation, retained experience and governed reusable knowledge have different lifecycles.  |
| Model output is untrusted                      | Provider output is schema-validated before persistence or downstream use.                    |
| Published objects are immutable                | A new version creates a new record; prior versions are superseded, not silently mutated.     |
| User data is private by default                | Cross-workspace access must pass the authority resolver.                                     |

Read the [architecture guide](./docs/architecture.md) and the [Architecture Decision Records](./docs/adr/) for the rationale behind these boundaries.

## Repository layout

```text
apps/web/                  Next.js application, authenticated shell and API routes
packages/contracts/        Zod schemas and environment contract
packages/domain/           pure domain rules and authorization core
packages/application/      application services, ports, adapters and migrations
scripts/                   repository checks and operational scripts
docs/                      architecture, development, testing, security and operations
.github/workflows/          GitHub Actions quality workflow
```

## Prerequisites

Use Node.js **20 or newer** and pnpm **9.15.0**, as declared by the repository `packageManager` field. A local database is optional for the unit suite because the application integration tests use in-process PostgreSQL-compatible infrastructure; it is required for database-backed development and manual verification.

## First-time setup

Clone the repository, install the locked dependency graph, and create the local environment file:

```bash
git clone https://github.com/hadiranweb/onsur.git
cd onsur
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Set at least `DATABASE_URL` and `AUTH_SECRET` in `.env.local`. Never commit `.env.local` or any secret value. For the default local database workflow, start the database and apply migrations:

```bash
pnpm db:start
pnpm db:migrate
```

Start the web application with the package-local command because the root package intentionally has no generic `dev` script:

```bash
pnpm --filter @element-plus/web dev
```

The application is available at [http://localhost:3000](http://localhost:3000). The health endpoint is [http://localhost:3000/api/health](http://localhost:3000/api/health). It reports environment and database state as `connected`, `error` or `not_configured` rather than inferring health from secret presence alone.

## Development workflow

Create a focused branch from `main`, keep changes within the owning architectural layer, and run the fast local checks before opening a pull request:

```bash
git switch -c arena/<short-description>
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm check:arch
pnpm build
```

The canonical branch is protected operationally through review and CI policy. Pull requests into `main` must pass the same quality gates defined in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml). Do not bypass a failing gate by weakening a contract or moving domain logic into the web layer.

## Validation commands

| Command              | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `pnpm format:check`  | Verify Prettier formatting without modifying files.         |
| `pnpm lint`          | Run the repository ESLint configuration.                    |
| `pnpm typecheck`     | Type-check all workspace packages.                          |
| `pnpm test`          | Run package unit, integration and vertical tests.           |
| `pnpm check:arch`    | Verify package dependency boundaries.                       |
| `pnpm build`         | Build all packages and the production Next.js application.  |
| `pnpm e2e:vertical`  | Run the HTTP-level vertical proof after a production build. |
| `pnpm e2e:authority` | Exercise workspace/resource authorization boundaries.       |

The CI workflow runs formatting, linting, typechecking, tests, architecture checks and the production build. Database-backed end-to-end commands remain explicit local or release checks because they require a running application and database lifecycle.

## Environment and operations

Configuration details, required variables, database lifecycle, health checks and recovery procedures are documented in the [configuration guide](./docs/configuration.md) and [operations guide](./docs/operations.md). Security assumptions, known limitations and v2 hardening items are documented in [security.md](./docs/security.md).

## Documentation map

| Guide                                                | Use it when you need to…                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Architecture](./docs/architecture.md)               | Understand layers, dependency direction, domain boundaries and request flow. |
| [Development](./docs/development.md)                 | Add a feature, choose a package, run the local loop and open a PR.           |
| [Configuration](./docs/configuration.md)             | Configure environment variables, PostgreSQL and local services.              |
| [Testing](./docs/testing.md)                         | Choose the right test layer and interpret validation failures.               |
| [Operations](./docs/operations.md)                   | Run, probe, migrate and troubleshoot the application.                        |
| [Security](./docs/security.md)                       | Review trust boundaries, authorization and known residual risks.             |
| [ADRs](./docs/adr/)                                  | Understand why architectural decisions were made.                            |
| [v1 audit](./docs/audits/v1-verification-40ffb97.md) | Review the latest implementation verification evidence.                      |

## Sprint roadmap

| Sprint | Scope                                        | Status  |
| -----: | -------------------------------------------- | ------- |
|     00 | Clean repository foundation                  | Done    |
|     01 | Canonical contracts and domain core          | Done    |
|     02 | PostgreSQL, identity and workspace           | Done    |
|     03 | Founder and structured problem solving       | Done    |
|     04 | Capability, process and island               | Done    |
|     05 | Run engine and fake runtime                  | Done    |
|     06 | OpenClaw adapter                             | Done    |
|     07 | Evidence, feedback and memory                | Done    |
|     08 | Knowledge governance and evolution           | Done    |
|     09 | Package protocol, outbox and connectors      | Done    |
|     10 | Controlled action island and mission control | Done    |
|     11 | Asset registry and marketplace               | Done    |
|     12 | v1 hardening and complete vertical proof     | Current |

## Contributing

Before proposing a change, read the relevant ADR and the [development guide](./docs/development.md). A contribution is ready when its owning package is clear, its public contracts are explicit, its failure modes are tested, its documentation is updated, and the full CI gate passes. Keep commits focused and describe architectural consequences in the pull request.

## License

MIT — see [LICENSE](./LICENSE).
