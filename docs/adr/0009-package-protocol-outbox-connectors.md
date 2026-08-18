# ADR 0009 — Element Package Protocol, transactional outbox, and connectors

- Status: accepted
- Sprint: 09
- Date: 2026-08-13

## Context

Sprint 09 makes the network language operational without introducing
distributed architecture: a package envelope, a transactional outbox, a
database-backed delivery job, and a connector contract. No Kafka/Redis.

## Decision

### Package protocol

- The envelope (`packageEnvelopeSchema`) carries `kind`
  (command/event/query/response/result/evidence), a required `correlationId`,
  an optional `causationId`, and `payload`/`provenance`.
- Pure invariants (`domain/rules/package.ts`): `causationId` must not equal the
  message id; a caused message correlates to the same chain as its cause.

### Transactional outbox

- `outbox_messages` persists package messages with status
  `pending | sent | failed`, attempt count, `available_at` (backoff), and error.
- Emitting a package writes the outbox message and a `package_events` domain
  record in the **same transaction** (`PgTransactionRunner`), so domain
  mutation + outbox creation are atomic.

### Database-backed delivery job

- `PackageService.deliverPending(batchSize)` selects due pending messages with
  `FOR UPDATE SKIP LOCKED`, delivers each through its connector, and marks it
  sent or failed with exponential backoff (capped at 60s, 8 attempts). A
  Next.js route (`POST /api/outbox`) triggers a pass; a scheduler can call it.

### Connector contract + one real connector

- `Connector` exposes `id`, `name`, `check()` (honest status: connected /
  not_configured / degraded / error), and `deliver(message)`.
- The **relay connector** persists deliveries to `connector_deliveries` with a
  unique `(connector_id, outbox_message_id)` key, so a duplicate outbox retry is
  a no-op (idempotent) — proven by the integration test.

## Consequences

- Correlation survives asynchronous delivery (message → delivery record).
- Retry-safe, at-least-once delivery with idempotent consumers; no duplicate
  protected effects.
- No message-broker infrastructure is introduced.
