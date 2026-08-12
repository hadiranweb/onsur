import { z } from 'zod'
import { idSchema, referenceSchema, versionSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Knowledge and VersionProposal.
 *
 * Knowledge is governed, versioned, and always backed by evidence references.
 * It evolves only through a VersionProposal review lifecycle; there is no
 * automatic canonical merge, and prior versions are preserved.
 */

export const knowledgeStatusSchema = z.enum(['draft', 'published', 'superseded'])

export type KnowledgeStatus = z.infer<typeof knowledgeStatusSchema>

export const knowledgeSchema = z.object({
  id: idSchema,
  version: versionSchema,
  status: knowledgeStatusSchema,
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  evidenceRefs: z.array(referenceSchema).default([]),
  provenance: provenanceSchema,
})

export type Knowledge = z.infer<typeof knowledgeSchema>

export const versionProposalStatusSchema = z.enum([
  'draft',
  'proposed',
  'under_review',
  'approved',
  'rejected',
  'merged',
])

export type VersionProposalStatus = z.infer<typeof versionProposalStatusSchema>

export const versionProposalEventSchema = z.enum([
  'propose',
  'review',
  'approve',
  'reject',
  'merge',
])

export type VersionProposalEvent = z.infer<typeof versionProposalEventSchema>

export const versionProposalSchema = z.object({
  id: idSchema,
  target: referenceSchema,
  fromVersion: versionSchema,
  toVersion: versionSchema,
  rationale: z.string().min(1).max(20000),
  evidenceRefs: z.array(referenceSchema).default([]),
  status: versionProposalStatusSchema,
  provenance: provenanceSchema,
})

export type VersionProposal = z.infer<typeof versionProposalSchema>
