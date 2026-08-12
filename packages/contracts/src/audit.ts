import { z } from 'zod'
import { idSchema, referenceSchema, timestampSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * AuditEvent: an immutable record of an authorization decision or other
 * security-relevant action. Default authorization is deny; every decision is
 * recorded with its outcome.
 */

export const auditOutcomeSchema = z.enum(['allow', 'deny'])

export type AuditOutcome = z.infer<typeof auditOutcomeSchema>

export const auditEventSchema = z.object({
  id: idSchema,
  actor: referenceSchema,
  action: z.string().min(1).max(200),
  target: referenceSchema,
  at: timestampSchema,
  outcome: auditOutcomeSchema,
  detail: z.record(z.unknown()).default({}),
  provenance: provenanceSchema,
})

export type AuditEvent = z.infer<typeof auditEventSchema>
