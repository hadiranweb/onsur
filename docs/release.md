# Release and CI Guide

`main` is the canonical branch. Changes reach it through reviewable pull requests, and GitHub Actions validates the same repository gates on the source branch and after merge.

## CI workflow

The workflow at `.github/workflows/ci.yml` runs on pushes to `main`, pushes to `arena/**`, and pull requests targeting `main`. It uses Node.js 22 and pnpm 9.15.0, installs from the frozen lockfile, and runs:

```text
format → lint → typecheck → test → architecture guard → production build
```

The workflow has read-only repository permissions and cancels superseded runs for the same ref. A successful local run is useful evidence, but a pull request is not ready until the GitHub check for its exact commit is successful.

## Pull request readiness

Before opening a pull request, verify that the branch is based on current `main`, the diff is focused, generated artifacts are absent, migrations are documented, and the local validation gate passes. The pull request description should summarize behavior, affected layers, tests, operational impact and any follow-up risk.

## Promotion to main

Use the following sequence:

```bash
git fetch origin --prune
git switch main
git pull --ff-only origin main
git switch -c arena/<short-description>
# implement and validate
git push -u origin HEAD
```

Open a pull request into `main`, wait for CI, obtain review, and merge using the repository’s selected merge policy. After merge, confirm that the `main` workflow succeeds for the merge commit. Do not delete the source branch until the merge and post-merge run have been confirmed.

## Production build

The web package explicitly invokes `next build` with `NODE_ENV=production` through its package script. This avoids environment-dependent prerender failures when a developer shell or runner exports a non-standard `NODE_ENV`.

```bash
pnpm build
pnpm --filter @element-plus/web start
```

Use the same environment contract and migration plan for the target deployment. Do not treat a successful compile as proof that database migrations, health probes or external connectors are ready.

## Rollback

If a merge introduces a regression, first identify whether the failure is in code, configuration, migration state or an external adapter. Revert the smallest safe change through a reviewed pull request when possible. For destructive database changes, follow the migration’s documented recovery plan rather than relying on a Git revert.

## Release evidence

A release or promotion record should include the merge commit, CI run URL, migration status, health endpoint result, known residual risks and the responsible reviewer. Keep secrets, session values and database credentials out of the record.
