# ADR 0002 — Identity, sessions, and PostgreSQL persistence

- Status: accepted
- Sprint: 02
- Date: 2026-08-13

## Context

Sprint 02 introduces real user identity, sessions, workspaces, and workspace
authorization. The baseline is PostgreSQL + the `pg` driver. The sandbox has no
system PostgreSQL and no Docker, and Debian apt mirrors are unreachable, but
the npm registry is reachable.

## Decision

### Local PostgreSQL via PGlite

The local development database is **PGlite** (`@electric-sql/pglite`), real
PostgreSQL compiled to WASM, exposed over the standard Postgres wire protocol
via `@electric-sql/pglite-socket` (`scripts/start-db.mjs`). The application
speaks to it through the ordinary `pg` driver and a `DATABASE_URL`, so the
adapter is unchanged for any hosted PostgreSQL.

### Ports and adapters

- Ports (repository + crypto interfaces) live in `packages/application`.
- The PostgreSQL adapter implements them over `pg`.
- Integration tests boot their own in-process PostgreSQL, run migrations, and
  exercise the real adapter; unit tests use in-memory fakes. This keeps the
  security tests runnable without external infrastructure.

### Sessions

- Each login issues a random 256-bit token; only its SHA-256 hash is stored in
  `sessions.token_hash`. No shared token is ever used as identity.
- The cookie stores `token.signature` where `signature = HMAC-SHA256(AUTH_SECRET, token)`,
  so tampered cookies are rejected before any lookup.
- Session validity is a pure function of `revoked_at` and `expires_at`
  (`domain/rules/identity.ts`).

### Workspaces

- `workspaces.kind` is `personal` or `team`; a partial unique index enforces one
  personal workspace per owner, and `createPersonalWorkspace` is idempotent.
- Authorization is default-deny (`domain/rules/workspace.ts`); the application
  `WorkspaceService.assertAccess` enforces it server-side.

### Passwords

- scrypt with a per-user random salt and constant-time verification
  (`ScryptPasswordHasher`), avoiding native binary dependencies.

## Consequences

- The local dev database is not a classic `postgres` binary; the wire protocol
  and SQL semantics are PostgreSQL, and production can point `DATABASE_URL` at a
  hosted instance with no code changes.
- Registration is not yet wrapped in a cross-table transaction (user +
  workspace + membership); crash atomicity arrives with the transactional
  outbox in Sprint 09. Noted as a known limitation.
