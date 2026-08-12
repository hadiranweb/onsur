import { z } from 'zod'
import { idSchema, referenceSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * MemoryEntry: scoped memory, distinct from evidence and knowledge.
 *
 * Runtime output is only ever a memory *candidate*; promotion to canonical
 * memory requires authorization and never happens automatically. Scope
 * (private | workspace | shared) is enforced on write and read.
 */

export const memoryScopeSchema = z.enum(['private', 'workspace', 'shared'])

export type MemoryScope = z.infer<typeof memoryScopeSchema>

export const memoryStatusSchema = z.enum(['candidate', 'promoted', 'rejected'])

export type MemoryStatus = z.infer<typeof memoryStatusSchema>

export const memoryEntrySchema = z.object({
  id: idSchema,
  scope: memoryScopeSchema,
  content: z.string().min(1).max(20000),
  fingerprint: z.string().min(1).max(256).optional(),
  tags: z.array(z.string().min(1).max(64)).default([]),
  sourceRun: referenceSchema.optional(),
  status: memoryStatusSchema,
  provenance: provenanceSchema,
})

export type MemoryEntry = z.infer<typeof memoryEntrySchema>
