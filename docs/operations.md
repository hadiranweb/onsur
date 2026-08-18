# Element Plus — operations guide

## Local development

```bash
pnpm install
pnpm db:start      # local PostgreSQL (PGlite over the wire protocol)
pnpm db:migrate    # apply versioned migrations (DATABASE_URL required)
pnpm --filter @element-plus/web dev  # Next.js dev server
```

Set `DATABASE_URL` and `AUTH_SECRET` (see `.env.example`).

## Migrations

- 22 versioned SQL migrations in `packages/application/migrations/`, applied in
  ascending order, each in its own transaction, recorded in `schema_migrations`.
- `pnpm db:migrate` is idempotent (re-running applies nothing).
- Production uses a hosted PostgreSQL by pointing `DATABASE_URL` at it; the
  adapter (`pg`) and migrations are unchanged.

## Backups

- No managed backup pipeline is provided in v1. Use standard PostgreSQL
  tooling against `DATABASE_URL`, e.g. `pg_dump`:

  ```bash
  pg_dump "$DATABASE_URL" --format=custom --file=element-plus-$(date +%F).dump
  pg_restore --clean --dbname="$DATABASE_URL" element-plus-<date>.dump
  ```

- Restore = database restore + `pnpm db:migrate` (no-op if schema_migrations is
  already current).

## Jobs / outbox

- Package messages are written to `outbox_messages` atomically with their
  `package_events` domain record (transactional outbox).
- Delivery is at-least-once and idempotent; a pass runs via `POST /api/outbox`
  (or `PackageService.deliverPending`). A scheduler (cron/systemd/Next.js
  instrumentation) calling the delivery pass periodically is a v2 item.
- Failed messages retry with exponential backoff (capped 60s, 8 attempts).

## Run recovery & runtime failure

- Runtime errors are normalized to `{ code, message }` and mark the run
  `failed` (with a `fail` timeline event).
- Stale non-terminal runs (queued/running/awaiting_approval) are recovered on
  web startup by `RunEngine.recoverStaleRuns` (30-minute default threshold):
  pending approvals are rejected, queued/awaiting runs are cancelled, running
  runs are failed. Nothing executes after recovery.

## Logging

- Structured JSON lines to stdout via `logger` (`packages/application/src/util/logger.ts`).
- `LOG_LEVEL` env (debug | info | warn | error, default info). No secrets logged.

## Health

- `GET /api/health` returns `ok` (200) or `degraded` (503) with:
  - environment validity (no values echoed),
  - `database` (connected / error / not_configured),
  - `openclaw` (connected / error / not_configured),
  - (Connections page additionally lists relay connector status).

## Validation gate

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test            # includes Postgres integration + vertical E2E
pnpm build
pnpm check:arch
pnpm e2e:vertical    # HTTP-level vertical E2E (requires `pnpm build` first)
```
