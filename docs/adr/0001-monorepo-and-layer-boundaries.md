# ADR 0001 — Monorepo layout and layer boundaries

- Status: accepted
- Sprint: 00
- Date: 2026-08-12

## Context

Element Plus (عنصر پلاس) is a new project with a strict layered architecture
(specification section "Architectural Non-Negotiables"). Sprint 00 establishes
the clean repository foundation before any product functionality exists.

## Decision

### Package manager and workspace

- pnpm workspaces with `apps/*` and `packages/*`.
- Strict TypeScript (5.9.x) everywhere.

### Package layout

- `packages/domain` — pure domain layer. Owns identity, workspace, problem,
  SPS, process, island, run, package, authority, evidence, memory, knowledge,
  provenance, and assets. Must have zero framework/runtime dependencies. May
  depend on `@element-plus/contracts` for **types only**.
- `packages/contracts` — canonical Zod schemas (the YAML domain language made
  executable). Framework-free; depends only on `zod`.
- `packages/application` — orchestration/application services. May depend on
  domain and contracts only.
- `apps/web` — the Next.js web application (the only framework host). May
  depend on domain, contracts, and application.

### Internal package consumption (Just-in-Time packages)

Internal packages export TypeScript source directly (`exports` -> `./src/index.ts`)
and are compiled by the consumer (`transpilePackages` in Next.js). Library
`build` scripts run `tsc --noEmit` as a typecheck gate rather than emitting
`dist/`. This avoids build-order and stale-dist problems for internal-only
packages.

### Dependency direction

Enforced by two mechanisms:

1. `scripts/check-architecture.mjs` — validates package.json dependency
   direction and forbids framework/runtime dependencies in the pure layers.
2. `packages/domain/src/__tests__/architecture.test.ts` — scans domain source
   for forbidden import specifiers and requires that any `@element-plus/contracts`
   import be type-only.

### Other

- MIT license (placeholder; replaceable by owner decision).
- `@element-plus/*` package scope even though the GitHub repository is named
  `onsur` (the product name "Element Plus" is canonical).

## Consequences

- The domain layer is guarded against accidental framework leakage from day one.
- Internal packages are not publishable to npm (source exports); publication of
  distributable assets is a separate concern (Sprint 11).
- A new package added to the workspace must be registered in the architecture
  guard allow-list.
