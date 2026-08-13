import type { Pool } from 'pg'
import type {
  OutboxMessageRecord,
  OutboxRepository,
  PackageEventRecord,
  PackageEventRepository,
  TransactionalScope,
  TransactionRunner,
} from '../ports'

function toIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    return new Date(value).toISOString()
  }
  throw new Error(`unexpected timestamp value: ${String(value)}`)
}

function mapOutbox(row: Record<string, unknown>): OutboxMessageRecord {
  return {
    id: row.id as string,
    kind: row.kind as OutboxMessageRecord['kind'],
    connectorId: row.connector_id as string,
    correlationId: row.correlation_id as string,
    causationId: (row.causation_id as string | null) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: row.status as OutboxMessageRecord['status'],
    attempts: Number(row.attempts),
    availableAt: toIso(row.available_at),
    sentAt: row.sent_at == null ? null : toIso(row.sent_at),
    error: (row.error as string | null) ?? null,
    createdAt: toIso(row.created_at),
  }
}

function mapPackageEvent(row: Record<string, unknown>): PackageEventRecord {
  return {
    id: row.id as string,
    kind: row.kind as PackageEventRecord['kind'],
    correlationId: row.correlation_id as string,
    causationId: (row.causation_id as string | null) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    provenance: row.provenance as PackageEventRecord['provenance'],
    createdAt: toIso(row.created_at),
  }
}

export class PgTransactionRunner implements TransactionRunner {
  constructor(private readonly pool: Pool) {}

  async run<T>(fn: (tx: TransactionalScope) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const scope: TransactionalScope = {
        query: (text, values) => client.query(text, values),
      }
      const result = await fn(scope)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

export class PgOutboxRepository implements OutboxRepository {
  constructor(private readonly pool: Pool) {}

  async createInTransaction(
    tx: TransactionalScope,
    input: Omit<OutboxMessageRecord, 'createdAt'>,
  ): Promise<void> {
    await tx.query(
      `INSERT INTO outbox_messages
         (id, kind, connector_id, correlation_id, causation_id, payload, status, attempts, available_at, sent_at, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        input.id,
        input.kind,
        input.connectorId,
        input.correlationId,
        input.causationId,
        JSON.stringify(input.payload),
        input.status,
        input.attempts,
        new Date(input.availableAt),
        input.sentAt ? new Date(input.sentAt) : null,
        input.error,
      ],
    )
  }

  async create(input: Omit<OutboxMessageRecord, 'createdAt'>): Promise<OutboxMessageRecord> {
    const result = await this.pool.query(
      `INSERT INTO outbox_messages
         (id, kind, connector_id, correlation_id, causation_id, payload, status, attempts, available_at, sent_at, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, kind, connector_id, correlation_id, causation_id, payload, status, attempts, available_at, sent_at, error, created_at`,
      [
        input.id,
        input.kind,
        input.connectorId,
        input.correlationId,
        input.causationId,
        JSON.stringify(input.payload),
        input.status,
        input.attempts,
        new Date(input.availableAt),
        input.sentAt ? new Date(input.sentAt) : null,
        input.error,
      ],
    )
    return mapOutbox(result.rows[0])
  }

  async findById(id: string): Promise<OutboxMessageRecord | null> {
    const result = await this.pool.query(
      `SELECT id, kind, connector_id, correlation_id, causation_id, payload, status, attempts, available_at, sent_at, error, created_at
         FROM outbox_messages WHERE id = $1`,
      [id],
    )
    return result.rows[0] ? mapOutbox(result.rows[0]) : null
  }

  async listPending(now: string, limit: number): Promise<OutboxMessageRecord[]> {
    const result = await this.pool.query(
      `SELECT id, kind, connector_id, correlation_id, causation_id, payload, status, attempts, available_at, sent_at, error, created_at
         FROM outbox_messages
        WHERE status = 'pending' AND available_at <= $1
        ORDER BY created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED`,
      [new Date(now), limit],
    )
    return result.rows.map(mapOutbox)
  }

  async markSent(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE outbox_messages SET status = 'sent', sent_at = now(), error = NULL WHERE id = $1`,
      [id],
    )
  }

  async markFailed(id: string, error: string, availableAt: string): Promise<void> {
    await this.pool.query(
      `UPDATE outbox_messages
          SET status = 'failed', attempts = attempts + 1, error = $2, available_at = $3
        WHERE id = $1`,
      [id, error, new Date(availableAt)],
    )
  }

  async list(): Promise<OutboxMessageRecord[]> {
    const result = await this.pool.query(
      `SELECT id, kind, connector_id, correlation_id, causation_id, payload, status, attempts, available_at, sent_at, error, created_at
         FROM outbox_messages ORDER BY created_at ASC`,
    )
    return result.rows.map(mapOutbox)
  }
}

export class PgPackageEventRepository implements PackageEventRepository {
  constructor(private readonly pool: Pool) {}

  async createInTransaction(
    tx: TransactionalScope,
    input: Omit<PackageEventRecord, 'createdAt'>,
  ): Promise<void> {
    await tx.query(
      `INSERT INTO package_events (id, kind, correlation_id, causation_id, payload, provenance)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.id,
        input.kind,
        input.correlationId,
        input.causationId,
        JSON.stringify(input.payload),
        JSON.stringify(input.provenance),
      ],
    )
  }

  async list(): Promise<PackageEventRecord[]> {
    const result = await this.pool.query(
      `SELECT id, kind, correlation_id, causation_id, payload, provenance, created_at
         FROM package_events ORDER BY created_at ASC`,
    )
    return result.rows.map(mapPackageEvent)
  }
}
