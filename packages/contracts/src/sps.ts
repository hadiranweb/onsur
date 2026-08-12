import { z } from 'zod'
import { idSchema, timestampSchema } from './ids'
import { problemItemSchema } from './problem'

/**
 * Structured Problem Solving (SPS) session contracts.
 *
 * A Founder session walks a deterministic state machine
 * (open → structuring → review → confirmed) driven by pure rules in the
 * domain layer. The structured LLM output is untrusted until it passes
 * `structuredProblemOutputSchema`.
 */

export const spsStatusSchema = z.enum(['open', 'structuring', 'review', 'confirmed'])

export type SpsStatus = z.infer<typeof spsStatusSchema>

export const spsEventSchema = z.enum(['submit', 'produced', 'correct', 'confirm', 'fail'])

export type SpsEvent = z.infer<typeof spsEventSchema>

export const spsMessageRoleSchema = z.enum(['user', 'assistant', 'system'])

export type SpsMessageRole = z.infer<typeof spsMessageRoleSchema>

export const spsMessageSchema = z.object({
  id: idSchema,
  sessionId: idSchema,
  role: spsMessageRoleSchema,
  content: z.string().min(1).max(20000),
  seq: z.number().int().nonnegative(),
  createdAt: timestampSchema,
})

export type SpsMessage = z.infer<typeof spsMessageSchema>

export const spsSessionSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  problemId: idSchema,
  status: spsStatusSchema,
  messages: z.array(spsMessageSchema).default([]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export type SpsSession = z.infer<typeof spsSessionSchema>

/**
 * The output of the structured LLM port. Model output is untrusted: the
 * Founder service validates it against this schema before it can become a
 * ProblemSpecification.
 */
export const structuredProblemOutputSchema = z.object({
  structuredUnderstanding: z.string().min(1).max(20000),
  items: z.array(problemItemSchema),
  successCriteria: z.array(z.string().min(1).max(4000)).min(1),
  constraints: z.array(z.string().min(1).max(4000)).default([]),
})

export type StructuredProblemOutput = z.infer<typeof structuredProblemOutputSchema>
