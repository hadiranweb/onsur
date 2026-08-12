import { z } from 'zod'
import { idSchema, referenceSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Agent: a model-backed actor that executes within a Run. Agents are distinct
 * from Islands (Island != Agent) and from Processes. An Agent's capabilities
 * are references, not the capabilities themselves.
 */

export const agentRoleSchema = z.enum(['planner', 'executor', 'critic'])

export type AgentRole = z.infer<typeof agentRoleSchema>

export const agentSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(200),
  role: agentRoleSchema,
  model: z.string().min(1).max(200),
  capabilities: z.array(referenceSchema).default([]),
  provenance: provenanceSchema,
})

export type Agent = z.infer<typeof agentSchema>
