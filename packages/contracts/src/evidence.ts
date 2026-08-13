import { z } from 'zod'
import { idSchema, referenceSchema } from './ids'
import { evidenceKindSchema } from './problem'
import { provenanceSchema } from './provenance'

/**
 * Evidence: an independently addressed unit of support, distinct from memory
 * and knowledge. Every piece of evidence carries an exact content fingerprint
 * for duplicate detection and passes through a quality gate.
 *
 * Evidence is workspace-scoped (raw user data is private by default).
 */

export const evidenceStatusSchema = z.enum(['intake', 'pending_review', 'accepted', 'rejected'])

export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>

export const evidenceEventSchema = z.enum(['submit', 'accept', 'reject'])

export type EvidenceEvent = z.infer<typeof evidenceEventSchema>

export const evidenceSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  kind: evidenceKindSchema,
  content: z.string().min(1).max(20000),
  fingerprint: z.string().min(1).max(256),
  status: evidenceStatusSchema,
  source: referenceSchema.optional(),
  provenance: provenanceSchema,
})

export type Evidence = z.infer<typeof evidenceSchema>
