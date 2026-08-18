import { z } from 'zod'
import { referenceSchema, timestampSchema } from './ids'
import { effectKindSchema } from './tool'

/**
 * Approval: the approval-semantics record for an irreversible external effect.
 *
 * A run requesting an irreversible effect pauses (status `awaiting_approval`)
 * and creates a pending Approval. The effect executes only when the Approval is
 * `approved`; `rejected` means the tool never executed.
 */

export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected'])

export type ApprovalStatus = z.infer<typeof approvalStatusSchema>

export const approvalSchema = z.object({
  id: z.string().min(1),
  runId: referenceSchema,
  toolCallId: referenceSchema,
  effectKind: effectKindSchema,
  status: approvalStatusSchema,
  requestedAt: timestampSchema,
  decidedAt: timestampSchema.nullable(),
  decidedBy: referenceSchema.nullable(),
})

export type Approval = z.infer<typeof approvalSchema>
