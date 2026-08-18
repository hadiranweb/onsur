# Testing Guide

Testing is organized by architectural boundary. Prefer the narrowest test that proves the behavior, then add a higher-level test when the behavior crosses a real boundary.

## Test layers

| Layer            | Location                                                                       | What it proves                                                            |
| ---------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Contracts        | `packages/contracts/src` and package tests                                     | Schemas accept valid data and reject malformed inputs.                    |
| Domain           | `packages/domain/src` and package tests                                        | Pure invariants, authorization decisions and state transitions.           |
| Application      | `packages/application/src/__tests__`                                           | Use cases, adapters, persistence behavior and orchestration.              |
| Vertical HTTP    | `packages/application/src/__tests__/vertical-e2e.test.ts` and scripts          | The web-facing path works across routing, application and persistence.    |
| Authority        | `packages/application/src/__tests__/authority.test.ts` and `e2e-authority.mjs` | Cross-workspace and resource access fails closed.                         |
| Architecture     | `scripts/check-architecture.mjs` and domain architecture tests                 | Package dependencies preserve the intended direction.                     |
| Production build | `apps/web` through `pnpm build`                                                | The Next.js application compiles and prerenders with production settings. |

## Standard validation gate

Run the same commands used by CI:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm check:arch
pnpm build
```

The repository test command runs all workspace tests. The application package includes unit tests, integration tests and vertical proof tests. The integration tests use in-process PostgreSQL-compatible infrastructure and do not require a separately managed external database.

## End-to-end commands

After a successful production build, run the vertical HTTP proof when validating the full application surface:

```bash
pnpm e2e:vertical
pnpm e2e:authority
```

These commands exercise a running application and database lifecycle. They are intentionally separate from the default CI job so the core quality gate remains deterministic and does not depend on an external service being available.

## What to test for a new feature

A feature should normally include a contract test when its boundary shape changes, a domain test when an invariant changes, an application test when orchestration or persistence changes, and an HTTP/vertical test when the user-visible path crosses the web application.

Every authorization-sensitive feature needs both an allowed case and a denial case. Every versioned or published object needs a test proving that correction creates history rather than silently mutating a previous version. Every external runtime or model response needs malformed-output coverage before persistence.

## Failure diagnosis

Start with the narrowest failed gate. Formatting failures are mechanical and should not be mixed with behavior changes. Typecheck failures usually indicate a contract or package-boundary mismatch. Unit failures should be isolated at the owning package before debugging the web surface. Architecture failures indicate an import-direction violation and require a boundary decision, not a bypass.

For a failed production build, first confirm that the command runs with `NODE_ENV=production`; the web package build script enforces this explicitly. Then inspect the route named by Next.js and reproduce with:

```bash
pnpm --filter @element-plus/web build
```

Do not fix a prerender error by moving domain logic into a client component or by weakening a schema without understanding the failure path.

## Test naming and determinism

Name tests after the invariant or observable behavior they protect. Tests must be deterministic, isolated and safe to run repeatedly. Do not rely on wall-clock timing, external credentials or a developer’s local database state unless the test explicitly owns and cleans up that dependency.
