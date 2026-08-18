# Configuration Guide

Configuration is environment-driven. Local values belong in `.env.local`, which is ignored by Git and must never contain values copied into documentation or commits.

## Required variables

| Variable       |                            Required | Purpose                                                                                                                    |
| -------------- | ----------------------------------: | -------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Yes for database-backed development | PostgreSQL connection string used by the application `pg` adapter.                                                         |
| `AUTH_SECRET`  |                                 Yes | Secret used to sign the session envelope. Use a long, random value and keep it stable for the lifetime of active sessions. |

The canonical environment contract lives in `packages/contracts`. When adding a variable, update the contract, `.env.example`, the relevant guide and the health validation path together.

## Local setup

```bash
cp .env.example .env.local
pnpm db:start
pnpm db:migrate
```

The local database helper starts PostgreSQL-compatible PGlite over the standard wire protocol at `127.0.0.1:5432`. Point `DATABASE_URL` at the resulting local endpoint. The application continues to use the ordinary `pg` driver, so a hosted PostgreSQL connection can be used in another environment.

## Session and authentication configuration

Passwords are scrypt-hashed with a per-user salt. Server-side sessions persist a SHA-256 hash of a random session token, while the browser receives an HMAC-signed envelope using `AUTH_SECRET`. Do not replace this with a shared identity token or expose `AUTH_SECRET` to the browser.

When rotating `AUTH_SECRET`, plan for session invalidation and communicate the operational effect. Never log the secret, session token, password or raw credential payload.

## Health endpoint

The application exposes `/api/health`. Its response distinguishes environment and database state rather than treating the presence of a secret as proof of service health. The meaningful states are:

```text
connected | error | not_configured
```

Use the endpoint for deployment probes and manual diagnosis, but do not expose sensitive connection details in its response.

## Database migrations

Migrations are versioned and owned by `packages/application`. Run them explicitly:

```bash
pnpm db:start
pnpm db:migrate
```

A migration should be additive or have a documented rollback/recovery story. Before applying a destructive or irreversible migration, take an environment-appropriate backup and record the operational plan in the pull request.

## Environment hygiene

The following rules are mandatory:

- Keep `.env.local` and all secret-bearing files outside commits.
- Use distinct credentials for local, CI and production environments.
- Prefer GitHub Actions secrets or the deployment platform’s secret store over repository variables for sensitive values.
- Do not use the presence of an environment variable as a connector health signal.
- Document a variable’s owner, requiredness and failure behavior when introducing it.

## Troubleshooting configuration

If the health endpoint reports `not_configured`, verify that the web process loaded `.env.local` and that the variable name matches the environment contract. If it reports `error`, check the database URL, server availability and migration state without printing credentials. If authentication fails after a secret rotation, existing sessions may need to be re-established.
