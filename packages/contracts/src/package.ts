import { z } from 'zod'
import { idSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Element Package Protocol envelope (canonical shape; delivery arrives in
 * Sprint 09). Every message is a command, event, query, response, result, or
 * evidence, correlated by correlation_id and chained by causation_id.
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
