import { z } from 'zod'
import { idSchema, referenceSchema, versionSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Process and ProcessStep: a reusable, ordered executable structure that
 * resolves a ProblemSpecification into steps. Processes are versioned and,
 * once published, must not be silently mutated.
 */

export const processStatusSchema = z.enum(['draft', 'validated', 'published', 'superseded'])

export type ProcessStatus = z.infer<typeof processStatusSchema>

export const processEventSchema = z.enum(['validate', 'publish', 'supersede'])

export type ProcessEvent = z.infer<typeof processEventSchema>

export const processStepStatusSchema = z.enum([
  'pending',
  'ready',
  'running',
  'completed',
  'failed',
  'skipped',
])

export type ProcessStepStatus = z.infer<typeof processStepStatusSchema>

export const processStepEventSchema = z.enum(['ready', 'run', 'complete', 'fail', 'skip'])

export type ProcessStepEvent = z.infer<typeof processStepEventSchema>

export const processStepSchema = z.object({
  id: idSchema,
  order: z.number().int().nonnegative(),
  title: z.string().min(1).max(200),
  instruction: z.string().min(1).max(8000),
  capability: referenceSchema.optional(),
  dependsOn: z.array(idSchema).default([]),
  status: processStepStatusSchema,
})

export type ProcessStep = z.infer<typeof processStepSchema>

export const processSchema = z.object({
  id: idSchema,
  version: versionSchema,
  status: processStatusSchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  steps: z.array(processStepSchema),
  provenance: provenanceSchema,
})

export type Process = z.infer<typeof processSchema>
