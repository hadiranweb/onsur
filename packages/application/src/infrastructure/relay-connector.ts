import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { Connector, OutboxMessageRecord } from '../ports'

/**
 * The relay connector is the one real, low-risk connector for Sprint 09.
 *
 * It persists delivered packages to `connector_deliveries` (no external
 * network, no Kafka/Redis). Delivery is idempotent by the unique
 * (connector_id, outbox_message_id) key, so a duplicate outbox retry never
 * duplicates the protected effect.
 */
export class RelayConnector implements Connector {
  readonly id = 'relay'
  readonly name = 'Relay (internal)'

  constructor(private readonly pool: Pool) {}

  async check(): Promise<{ status: 'connected' | 'error'; detail?: string }> {
    try {
      await this.pool.query('SELECT 1')
      return { status: 'connected' }
    } catch (error) {
      return { status: 'error', detail: error instanceof Error ? error.message : String(error) }
    }
  }

  async deliver(message: OutboxMessageRecord): Promise<void> {
    // ON CONFLICT DO NOTHING makes a duplicate delivery a no-op (idempotent).
    // A fresh delivery id avoids colliding with the outbox message's primary key.
    await this.pool.query(
      `INSERT INTO connector_deliveries (id, connector_id, outbox_message_id, correlation_id, payload)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (connector_id, outbox_message_id) DO NOTHING`,
      [randomUUID(), this.id, message.id, message.correlationId, JSON.stringify(message.payload)],
    )
  }
}
