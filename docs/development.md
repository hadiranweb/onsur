# Development Guide

This guide explains how to make a change in Element Plus without weakening its domain boundaries. Read it together with the [architecture guide](./architecture.md), the relevant [ADR](./adr/) and the [testing guide](./testing.md).

## The change loop

A reliable change follows the same sequence: understand the owning boundary, write or update the contract, implement the smallest change in the owning package, add tests for the success and failure paths, run the repository gate, and document any architectural decision.

```text
Question → contract → domain rule → application orchestration → adapter → web surface
```

Do not begin in `apps/web` if the behavior is a domain rule. Do not place provider-specific behavior in `packages/contracts` or `packages/domain`. If a change crosses a layer, make the crossing explicit through an existing port or a new reviewed port.

## Choosing the package

| Change                                                           | Owning location                    |
| ---------------------------------------------------------------- | ---------------------------------- |
| Zod schema, input/output shape or environment contract           | `packages/contracts`               |
| Invariant, authorization decision or pure business rule          | `packages/domain`                  |
| Use case, orchestration, persistence port or integration adapter | `packages/application`             |
| Page, route handler, session boundary or UI interaction          | `apps/web`                         |
| Repository boundary check or developer automation                | `scripts/` or `.github/workflows/` |
| Architectural rationale                                          | `docs/adr/`                        |

The dependency direction is intentionally one-way. `packages/domain` must remain free of Next.js, React, PostgreSQL drivers, OpenClaw and provider SDKs. `packages/contracts` defines the language shared across boundaries; it should not contain orchestration.

## Branches and commits

Start from the current `main` branch and use a focused branch name:

```bash
git switch main
git pull --ff-only origin main
git switch -c arena/<short-description>
```

Keep commits small enough to review. A useful commit explains one change, for example `feat(domain): enforce workspace authority` or `test(application): cover stale run recovery`. Avoid commits that mix formatting noise, dependency upgrades and behavior changes.

## Contracts before implementations

When adding a capability, define its input, output, failure and authority requirements first. The contract should answer four questions:

1. What data is accepted, and how is it validated?
2. Which invariant or authorization rule must hold?
3. Which side effects are permitted, and which port owns them?
4. What observable result represents success, denial, partial completion or failure?

Provider or runtime output is untrusted until schema validation succeeds. Published and versioned objects are immutable by construction: correction creates a new version or event rather than silently mutating history.

## Local commands

Install exactly from the lockfile and use the package-local Next.js command for the web app:

```bash
pnpm install --frozen-lockfile
pnpm --filter @element-plus/web dev
```

Run the short feedback loop before a commit:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm check:arch
pnpm build
```

The database commands are explicit because they start a real PostgreSQL-compatible local service and apply migrations:

```bash
pnpm db:start
pnpm db:migrate
```

## Pull requests

A pull request should explain the problem, the selected owning layer, the contract or invariant changed, the tests added, and any operational or migration consequence. Link the relevant ADR when a decision is durable or cross-cutting.

Before requesting review, confirm that the local commands match the CI workflow. The production build must run with `NODE_ENV=production`; this is enforced by the web package build script. Do not mark a pull request ready while a required gate is skipped or while generated artifacts are present in the diff.

## Adding an ADR

Create an ADR when a change affects dependency direction, persistence strategy, authority semantics, runtime integration, versioning, or another decision that future contributors would otherwise have to rediscover. Use the existing numbered records as the format reference:

```text
docs/adr/0014-short-decision-title.md
```

Each ADR should state the context, decision, alternatives considered, consequences, and the status of the decision. Update the README or architecture guide when the decision changes the normal development path.

## Review checklist

A reviewer should be able to answer yes to these questions:

| Review question                                   | Expected answer                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Is the owning layer obvious?                      | Yes; the change follows the dependency direction.                                               |
| Are public inputs and outputs validated?          | Yes; contracts reject malformed data before persistence.                                        |
| Are authorization and tenant boundaries explicit? | Yes; default-deny behavior is preserved.                                                        |
| Are negative paths tested?                        | Yes; denial, malformed output, stale state and duplicate operations are covered where relevant. |
| Is history preserved?                             | Yes; corrections and version changes are non-destructive.                                       |
| Is the operational impact documented?             | Yes; migrations, env variables and recovery behavior are stated.                                |
