import { randomUUID } from 'node:crypto'
import { validatePackageCorrelation } from '@element-plus/domain'
import type { PackageEnvelope, PackageKind } from '@element-plus/contracts'
import { AppError } from '../errors'
import type {
  Connector,
  OutboxMessageRecord,
  OutboxRepository,
  PackageEventRepository,
  TransactionRunner,
} from '../ports'
import { makeProvenance } from '../util/provenance'
import { normalizeError } from '../util/normalize-error'

export interface PublishPackageInput {
  kind: PackageKind
  connectorId: string
  correlationId?: string
  causationId?: string
  payload?: Record<string, unknown>
  actorUserId: string
}

export interface PackageServiceDeps {
  outbox: OutboxRepository
  packageEvents: PackageEventRepository
  transactions: TransactionRunner
  connectors: Connector[]
  now?: () => Date
}

const MAX_ATTEMPTS = 8
const MAX_BACKOFF_MS = 60_000

export class PackageService {
  private readonly now: () => Date
  private readonly connectorsById: Map<string, Connector>

  constructor(private readonly deps: PackageServiceDeps) {
    this.now = deps.now ?? (() => new Date())
    this.connectorsById = new Map(deps.connectors.map((connector) => [connector.id, connector]))
  }

  /**
   * Emit a package: validate it, then atomically persist the outbox message
   * and the domain package-event record in one transaction.
   */
  async publish(input: PublishPackageInput): Promise<OutboxMessageRecord> {
    const id = randomUUID()
    const correlationId = input.correlationId ?? id
    const causationId = input.causationId ?? null
    const payload = input.payload ?? {}

    const envelope: PackageEnvelope = {
      id,
      kind: input.kind,
      correlationId,
      causationId: causationId ?? undefined,
      payload,
      provenance: makeProvenance({
        actorUserId: input.actorUserId,
        reason: `emitted ${input.kind} package`,
        createdAt: this.now().toISOString(),
      }),
    }
    const issues = validatePackageCorrelation(envelope)
    if (issues.length > 0) {
      throw new AppError('INVALID_INPUT', issues.join('; '))
    }

    const message: Omit<OutboxMessageRecord, 'createdAt'> = {
      id,
      kind: input.kind,
      connectorId: input.connectorId,
      correlationId,
      causationId,
      payload,
      status: 'pending',
      attempts: 0,
      availableAt: this.now().toISOString(),
      sentAt: null,
      error: null,
    }

    // Domain mutation + outbox creation are atomic.
    await this.deps.transactions.run(async (tx) => {
      await this.deps.packageEvents.createInTransaction(tx, {
        id: randomUUID(),
        kind: input.kind,
        correlationId,
        causationId,
        payload,
        provenance: envelope.provenance,
      })
      await this.deps.outbox.createInTransaction(tx, message)
    })

    const created = await this.deps.outbox.findById(id)
    if (!created) {
      throw new AppError('CONFLICT', 'outbox message was not persisted')
    }
    return created
  }

  /**
   * One delivery pass: route due pending messages to their connector with
   * retry-safe semantics (at-least-once; consumers are idempotent).
   */
  async deliverPending(batchSize = 50): Promise<number> {
    const pending = await this.deps.outbox.listPending(this.now().toISOString(), batchSize)
    let delivered = 0
    for (const message of pending) {
      const connector = this.connectorsById.get(message.connectorId)
      if (!connector) {
        await this.deps.outbox.markFailed(message.id, 'connector not found', farFuture())
        continue
      }
      try {
        await connector.deliver(message)
        await this.deps.outbox.markSent(message.id)
        delivered += 1
      } catch (error) {
        const normalized = normalizeError(error)
        const attempts = message.attempts + 1
        const availableAt =
          attempts >= MAX_ATTEMPTS
            ? farFuture()
            : new Date(
                this.now().getTime() + Math.min(2 ** attempts * 1000, MAX_BACKOFF_MS),
              ).toISOString()
        await this.deps.outbox.markFailed(message.id, normalized.message, availableAt)
      }
    }
    return delivered
  }

  async getOutbox(): Promise<OutboxMessageRecord[]> {
    return this.deps.outbox.list()
  }

  listConnectors(): Connector[] {
    return [...this.connectorsById.values()]
  }

  getConnector(id: string): Connector | undefined {
    return this.connectorsById.get(id)
  }
}

function farFuture(): string {
  return new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
}
