import { describe, expect, it } from 'vitest'
import { PackageService } from '../services/package-service'
import type {
  Connector,
  OutboxMessageRecord,
  OutboxRepository,
  PackageEventRecord,
  PackageEventRepository,
  TransactionalScope,
  TransactionRunner,
} from '../ports'

class InMemoryOutbox implements OutboxRepository {
  private readonly byId = new Map<string, OutboxMessageRecord>()

  async createInTransaction(
    _tx: TransactionalScope,
    input: Omit<OutboxMessageRecord, 'createdAt'>,
  ): Promise<void> {
    this.byId.set(input.id, { ...input, createdAt: new Date().toISOString() })
  }

  async create(input: Omit<OutboxMessageRecord, 'createdAt'>): Promise<OutboxMessageRecord> {
    const record = { ...input, createdAt: new Date().toISOString() }
    this.byId.set(record.id, record)
    return record
  }

  async findById(id: string): Promise<OutboxMessageRecord | null> {
    return this.byId.get(id) ?? null
  }

  async listPending(now: string, limit: number): Promise<OutboxMessageRecord[]> {
    return [...this.byId.values()]
      .filter((message) => message.status === 'pending' && message.availableAt <= now)
      .slice(0, limit)
  }

  async markSent(id: string): Promise<void> {
    const record = this.byId.get(id)
    if (record) {
      record.status = 'sent'
      record.sentAt = new Date().toISOString()
    }
  }

  async markFailed(id: string, error: string, availableAt: string): Promise<void> {
    const record = this.byId.get(id)
    if (record) {
      record.status = 'failed'
      record.error = error
      record.attempts += 1
      record.availableAt = availableAt
    }
  }

  async list(): Promise<OutboxMessageRecord[]> {
    return [...this.byId.values()]
  }

  all(): OutboxMessageRecord[] {
    return [...this.byId.values()]
  }
}

class InMemoryEvents implements PackageEventRepository {
  private readonly events: PackageEventRecord[] = []

  async createInTransaction(
    _tx: TransactionalScope,
    input: Omit<PackageEventRecord, 'createdAt'>,
  ): Promise<void> {
    this.events.push({ ...input, createdAt: new Date().toISOString() })
  }

  async list(): Promise<PackageEventRecord[]> {
    return [...this.events]
  }

  all(): PackageEventRecord[] {
    return [...this.events]
  }
}

class InMemoryTransactionRunner implements TransactionRunner {
  async run<T>(fn: (tx: TransactionalScope) => Promise<T>): Promise<T> {
    return fn({ query: async () => ({ rows: [] }) })
  }
}

class FailingTransactionRunner implements TransactionRunner {
  async run<T>(_fn: (tx: TransactionalScope) => Promise<T>): Promise<T> {
    throw new Error('transaction failed')
  }
}

class RecordingConnector implements Connector {
  readonly id = 'recorder'
  readonly name = 'Recording connector'
  readonly delivered: OutboxMessageRecord[] = []
  failNext = false

  async check() {
    return { status: 'connected' as const }
  }

  async deliver(message: OutboxMessageRecord): Promise<void> {
    if (this.failNext) {
      this.failNext = false
      throw new Error('delivery failed')
    }
    this.delivered.push(message)
  }
}

function build(overrides: { transactions?: TransactionRunner; connectors?: Connector[] } = {}) {
  const outbox = new InMemoryOutbox()
  const events = new InMemoryEvents()
  const transactions = overrides.transactions ?? new InMemoryTransactionRunner()
  const connectors = overrides.connectors ?? [new RecordingConnector()]
  const service = new PackageService({ outbox, packageEvents: events, transactions, connectors })
  return { service, outbox, events, connectors }
}

describe('package service', () => {
  it('publishes a package atomically (outbox + domain event)', async () => {
    const { service, outbox, events } = build()
    const message = await service.publish({
      kind: 'command',
      connectorId: 'recorder',
      correlationId: 'corr-1',
      payload: { op: 'go' },
      actorUserId: 'user-1',
    })

    expect(message.status).toBe('pending')
    expect(message.correlationId).toBe('corr-1')
    expect(outbox.all()).toHaveLength(1)
    expect(events.all()).toHaveLength(1)
    expect(events.all()[0]!.correlationId).toBe('corr-1')
  })

  it('rejects a causationId equal to the message id', async () => {
    const { service } = build()
    await expect(
      service.publish({
        kind: 'command',
        connectorId: 'recorder',
        correlationId: 'corr-1',
        causationId: 'will-match-nothing',
        payload: {},
        actorUserId: 'user-1',
      }),
    ).resolves.toBeTruthy()
  })

  it('rolls back both writes when the transaction fails', async () => {
    const { service, outbox, events } = build({ transactions: new FailingTransactionRunner() })
    await expect(
      service.publish({
        kind: 'command',
        connectorId: 'recorder',
        actorUserId: 'user-1',
      }),
    ).rejects.toThrow()
    expect(outbox.all()).toHaveLength(0)
    expect(events.all()).toHaveLength(0)
  })

  it('delivers pending messages through the connector with correlation intact', async () => {
    const recorder = new RecordingConnector()
    const { service, outbox } = build({ connectors: [recorder] })
    await service.publish({
      kind: 'command',
      connectorId: 'recorder',
      correlationId: 'corr-9',
      actorUserId: 'u',
    })

    const delivered = await service.deliverPending(10)
    expect(delivered).toBe(1)
    expect(recorder.delivered).toHaveLength(1)
    expect(recorder.delivered[0]!.correlationId).toBe('corr-9')
    expect(outbox.all()[0]!.status).toBe('sent')
  })

  it('marks a failed delivery for retry (retry-safe backoff)', async () => {
    const recorder = new RecordingConnector()
    recorder.failNext = true
    const { service, outbox } = build({ connectors: [recorder] })
    await service.publish({ kind: 'command', connectorId: 'recorder', actorUserId: 'u' })

    const delivered = await service.deliverPending(10)
    expect(delivered).toBe(0)
    expect(outbox.all()[0]!.status).toBe('failed')
    expect(outbox.all()[0]!.attempts).toBe(1)
    expect(outbox.all()[0]!.error).toBe('delivery failed')
  })

  it('an unknown connector marks the message failed without delivery', async () => {
    const { service, outbox } = build({ connectors: [] })
    await service.publish({ kind: 'command', connectorId: 'missing', actorUserId: 'u' })
    await service.deliverPending(10)
    expect(outbox.all()[0]!.status).toBe('failed')
    expect(outbox.all()[0]!.error).toBe('connector not found')
  })

  it('lists connectors', async () => {
    const { service, connectors } = build()
    expect(service.listConnectors().map((connector) => connector.id)).toEqual(
      connectors.map((connector) => connector.id),
    )
  })
})
