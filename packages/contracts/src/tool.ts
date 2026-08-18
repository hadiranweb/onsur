import { z } from 'zod'
import { idSchema, referenceSchema, timestampSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Tool, ToolCall, and EffectRecord.
 *
 * Effect kinds:
 * - read_only              — no external effect.
 * - external_reversible    — external effect that can be undone.
 * - external_irreversible  — external effect that cannot be undone; requires
 *                            explicit approval (default authorization is deny).
 */

export const effectKindSchema = z.enum([
  'read_only',
  'external_reversible',
  'external_irreversible',
])

export type EffectKind = z.infer<typeof effectKindSchema>

export const toolContractSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  inputSchema: z.record(z.unknown()),
  effectKind: effectKindSchema,
  requiresApproval: z.boolean(),
  provenance: provenanceSchema,
})

export type ToolContract = z.infer<typeof toolContractSchema>

export const toolCallSchema = z.object({
  id: idSchema,
  toolId: referenceSchema,
  arguments: z.record(z.unknown()),
  effectKind: effectKindSchema,
  requiresApproval: z.boolean(),
})

export type ToolCall = z.infer<typeof toolCallSchema>

export const effectRecordSchema = z.object({
  id: idSchema,
  toolCallId: referenceSchema,
  kind: effectKindSchema,
  description: z.string().min(1).max(4000),
  occurredAt: timestampSchema,
  reverted: z.boolean().default(false),
})

export type EffectRecord = z.infer<typeof effectRecordSchema>
