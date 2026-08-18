# Element Plus — v1 security review

This is an evidence-based checklist; "secure" is never claimed as a blanket
statement, only per-item with the mechanism and where it is tested.

## Identity & sessions

- Passwords scrypt-hashed with a per-user random salt; constant-time verify
  (`ScryptPasswordHasher`). Never returned by any API (`publicUserSchema`).
- Server-side sessions: a random 256-bit token per session; only its SHA-256
  hash is stored (`sessions.token_hash`); the cookie carries an HMAC-signed
  envelope (`AUTH_SECRET`). Tampered cookies are rejected before lookup.
- No shared token is used as identity. Logout revokes the session; session
  validity is pure (`isSessionActive`: `revoked_at` + `expires_at`).

## Authorization (default deny)

- Workspace access requires a membership at or above the required role
  (`domain/rules/workspace.ts`); non-members get a uniform 404 on workspace
  detail (no existence leak). Tested: cross-workspace denial (unit + integration).
- Tool execution passes a permission gate (`domain/rules/authority.ts`):
  irreversible always requires approval; approval/rejection is recorded; a
  rejected tool never executes. Tested: run-engine + vertical E2E.
- Memory is scope-authorized (`canReadMemory`/`canWriteMemory`): private =
  owner only, workspace = members, shared = members write / any authenticated
  read. Tested: cross-workspace retrieval denied.
- Asset install/fork: private assets only by owner; fork of others requires
  public visibility. Tested.

## Secrets & environment

- `.env*` are gitignored; `.env.example` contains no secrets.
- `AUTH_SECRET` is validated (≥16 chars) and required at runtime; `DATABASE_URL`
  is required. The health surface reports environment validity without
  echoing values.
- No credentials/keys/tokens are committed; the repo contains no production data.

## Data & invariants

- Raw user data is workspace-scoped.
- Execution resources are authorized through explicit workspace/resource
  authority (`ResourceAccessService`): a Run carries an explicit execution
  workspace; Run create/read/cancel/approve/evaluate and its derived data
  (events, tool calls, effects, artifacts, evaluations) resolve authority
  through the owning Run. Ungranted raw cross-workspace access fails closed
  (verified by `authority.test.ts`, integration tests, and
  `pnpm e2e:authority`).
- Future legitimate cross-workspace relationships (installed / shared /
  delegated / public / contractual) must pass the authority resolver extension
  seam — they are not implemented in v1.
- Published/versioned objects are immutable by construction (new version =
  new row; prior version superseded, never mutated).
- Model output is untrusted until schema-validated; malformed output is
  rejected before persistence.
- Connector status distinguishes connected / not_configured / degraded / error
  from a live probe — never inferred from a secret's presence.

> Remediation note (R0): prior text claimed workspace isolation "at every
> service boundary"; that was contradicted by the v1 audit for the Run engine.
> R0 closed that gap for execution resources as described above.

## Residual risks (documented)

- Single-tenant, single-process run execution (in-memory approval waiter):
  mitigated by `recoverStaleRuns` on startup; a multi-worker outbox/queue is v2.
- Registration spans user + workspace + membership without a cross-table
  transaction (crash between writes could leave an orphan personal-workspace
  creation retry; retry is idempotent). v2: transactional composition.
- No rate limiting / brute-force protection on login endpoints (v2).
- CSRF: state-changing POSTs are form-encoded without an anti-CSRF token
  (SameSite=Lax mitigates cross-site form POSTs from browsers); explicit CSRF
  tokens are a v2 hardening item.
