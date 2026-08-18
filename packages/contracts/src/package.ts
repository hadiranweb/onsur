import { z } from 'zod'
import { idSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Element Package Protocol envelope (canonical shape). Every message is a
 * command, event, query, response, result, or evidence, correlated by
 * correlation_id and chained by causation_id.
 *
 * Delivery is at-least-once through the transactional outbox; consumers must
 * be idempotent.
 */

export const packageKindSchema = z.enum([
  'command',
  'event',
  'query',
  'response',
  'result',
  'evidence',
])

export type PackageKind = z.infer<typeof packageKindSchema>

export const packageEnvelopeSchema = z.object({
  id: idSchema,
  kind: packageKindSchema,
  correlationId: idSchema,
  causationId: idSchema.optional(),
  payload: z.record(z.unknown()),
  provenance: provenanceSchema,
})

export type PackageEnvelope = z.infer<typeof packageEnvelopeSchema>

/** Outbox delivery status for a persisted package message. */
export const packageDeliveryStatusSchema = z.enum(['pending', 'sent', 'failed'])

export type PackageDeliveryStatus = z.infer<typeof packageDeliveryStatusSchema>

/**
 * Connector status. `connected` means a live probe succeeded; `not_configured`
 * means the connector has no configuration; `degraded` means it works but with
 * reduced capability; `error` means a probe failed.
 */
export const connectorStatusSchema = z.enum(['connected', 'not_configured', 'degraded', 'error'])

export type ConnectorStatus = z.infer<typeof connectorStatusSchema>
