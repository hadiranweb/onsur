import { z } from 'zod'
import { idSchema, referenceSchema, versionSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Island and RuntimeBinding.
 *
 * Non-negotiable boundaries (from the spec):
 * - Island != Agent
 * - Island != Process
 * - Island != Workspace
 * - Island != Service
 *
 * An Island is a deployable unit that binds capabilities to a runtime through
 * a RuntimeBinding. The runtime is an adapter (e.g. a fake or OpenClaw), never
 * Element Plus itself.
 */

export const runtimeKindSchema = z.enum(['none', 'fake', 'openclaw'])

export type RuntimeKind = z.infer<typeof runtimeKindSchema>

export const runtimeBindingSchema = z.object({
  runtime: runtimeKindSchema,
  adapterVersion: z.string().min(1).max(64).optional(),
  config: z.record(z.unknown()).default({}),
})

export type RuntimeBinding = z.infer<typeof runtimeBindingSchema>

export const islandStatusSchema = z.enum(['draft', 'candidate', 'active', 'retired'])

export type IslandStatus = z.infer<typeof islandStatusSchema>

export const islandEventSchema = z.enum(['propose', 'activate', 'retire', 'reject'])

export type IslandEvent = z.infer<typeof islandEventSchema>

export const islandSchema = z.object({
  id: idSchema,
  version: versionSchema,
  status: islandStatusSchema,
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  capabilities: z.array(referenceSchema).min(1),
  runtime: runtimeBindingSchema,
  permissions: z.array(z.string().min(1).max(200)).default([]),
  provenance: provenanceSchema,
})

export type Island = z.infer<typeof islandSchema>
