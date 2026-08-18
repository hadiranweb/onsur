import { z } from 'zod'
import { idSchema, referenceSchema, timestampSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Run, RunEvent, and Artifact.
 *
 * A Run executes an Island against a resolved Process for a confirmed
 * ProblemSpecification. The Run snapshot is immutable; the Run state advances
 * through a strict state machine (see @element-plus/domain) and every change
 * is recorded on the RunEvent timeline.
 */

export const runStatusSchema = z.enum([
  'draft',
  'queued',
  'running',
  'awaiting_approval',
  'completed',
  'failed',
  'cancelled',
])

export type RunStatus = z.infer<typeof runStatusSchema>

export const runEventTypeSchema = z.enum([
  'enqueue',
  'start',
  'request_approval',
  'approve',
  'reject',
  'complete',
  'fail',
  'cancel',
  'log',
])

export type RunEventType = z.infer<typeof runEventTypeSchema>

export const runSnapshotSchema = z.object({
  problemSpec: referenceSchema,
  island: referenceSchema,
  process: referenceSchema.optional(),
  createdAt: timestampSchema,
})

export type RunSnapshot = z.infer<typeof runSnapshotSchema>

export const runEventSchema = z.object({
  id: idSchema,
  seq: z.number().int().nonnegative(),
  type: runEventTypeSchema,
  at: timestampSchema,
  payload: z.record(z.unknown()).default({}),
})

export type RunEvent = z.infer<typeof runEventSchema>

export const runSchema = z.object({
  id: idSchema,
  status: runStatusSchema,
  snapshot: runSnapshotSchema,
  events: z.array(runEventSchema).default([]),
  provenance: provenanceSchema,
})

export type Run = z.infer<typeof runSchema>

export const artifactKindSchema = z.enum(['result', 'log', 'output', 'memory_candidate'])

export type ArtifactKind = z.infer<typeof artifactKindSchema>

export const artifactSchema = z.object({
  id: idSchema,
  runId: referenceSchema,
  kind: artifactKindSchema,
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative().optional(),
  data: z.unknown(),
  provenance: provenanceSchema,
})

export type Artifact = z.infer<typeof artifactSchema>
