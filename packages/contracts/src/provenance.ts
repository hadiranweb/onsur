import { z } from 'zod'
import { referenceSchema, timestampSchema } from './ids'

/**
 * Provenance: who/what created an object, when, from what lineage, and why.
 * Every canonical, versioned object carries provenance. Evidence, memory, and
 * knowledge are separate concepts and must never be conflated with provenance.
 */

export const provenanceSourceSchema = z.enum(['user', 'system', 'runtime', 'import', 'connector'])

export type ProvenanceSource = z.infer<typeof provenanceSourceSchema>

export const provenanceSchema = z.object({
  actor: referenceSchema.optional(),
  createdAt: timestampSchema,
  derivedFrom: z.array(referenceSchema).default([]),
  reason: z.string().min(1).max(2000),
  source: provenanceSourceSchema,
})

export type Provenance = z.infer<typeof provenanceSchema>
