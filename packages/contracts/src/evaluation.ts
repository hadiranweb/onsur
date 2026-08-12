import { z } from 'zod'
import { idSchema, referenceSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Evaluation and Feedback.
 *
 * An Evaluation scores a completed Run against explicit criteria. Feedback is
 * user input about a Run and traces back to that Run; feedback can later
 * support a MemoryCandidate or a VersionProposal.
 */

export const evaluationVerdictSchema = z.enum(['pass', 'fail', 'needs_review'])

export type EvaluationVerdict = z.infer<typeof evaluationVerdictSchema>

export const evaluationCriterionSchema = z.object({
  name: z.string().min(1).max(200),
  met: z.boolean(),
  note: z.string().max(4000).optional(),
})

export type EvaluationCriterion = z.infer<typeof evaluationCriterionSchema>

export const evaluationSchema = z.object({
  id: idSchema,
  runId: referenceSchema,
  verdict: evaluationVerdictSchema,
  score: z.number().min(0).max(1).optional(),
  criteria: z.array(evaluationCriterionSchema).default([]),
  provenance: provenanceSchema,
})

export type Evaluation = z.infer<typeof evaluationSchema>

export const feedbackStatusSchema = z.enum([
  'submitted',
  'triaged',
  'accepted',
  'rejected',
  'applied',
])

export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>

export const feedbackEventSchema = z.enum(['triage', 'accept', 'reject', 'apply'])

export type FeedbackEvent = z.infer<typeof feedbackEventSchema>

export const feedbackSchema = z.object({
  id: idSchema,
  runId: referenceSchema,
  content: z.string().min(1).max(20000),
  status: feedbackStatusSchema,
  provenance: provenanceSchema,
})

export type Feedback = z.infer<typeof feedbackSchema>
