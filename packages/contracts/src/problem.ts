import { z } from 'zod'
import { idSchema, referenceSchema, versionSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * ProblemSpecification: the confirmed, versioned understanding of a raw
 * problem. The raw user statement is preserved verbatim; the structured
 * understanding separates evidence, assumptions, and unknowns, and captures
 * explicit success criteria.
 */

export const problemStatusSchema = z.enum(['draft', 'confirmed', 'superseded'])

export type ProblemStatus = z.infer<typeof problemStatusSchema>

/** The evidence / assumption / unknown separation required by the spec. */
export const evidenceKindSchema = z.enum(['evidence', 'assumption', 'unknown'])

export type EvidenceKind = z.infer<typeof evidenceKindSchema>

export const problemItemSchema = z.object({
  kind: evidenceKindSchema,
  text: z.string().min(1).max(4000),
  source: referenceSchema.optional(),
})

export type ProblemItem = z.infer<typeof problemItemSchema>

export const problemSpecificationSchema = z.object({
  id: idSchema,
  version: versionSchema,
  status: problemStatusSchema,
  rawProblem: z.string().min(1).max(20000),
  structuredUnderstanding: z.string().min(1).max(20000),
  items: z.array(problemItemSchema),
  successCriteria: z.array(z.string().min(1).max(4000)).min(1),
  constraints: z.array(z.string().min(1).max(4000)).default([]),
  provenance: provenanceSchema,
})

export type ProblemSpecification = z.infer<typeof problemSpecificationSchema>
