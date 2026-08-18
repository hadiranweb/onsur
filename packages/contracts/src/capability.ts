import { z } from 'zod'
import { idSchema, versionSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Capability: a named, versioned unit of reusable ability that Islands
 * expose and Processes reference. Capabilities are resolved against the
 * Capability Registry before a Process or Island is created (reuse first).
 */

export const capabilitySchema = z.object({
  id: idSchema,
  version: versionSchema,
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  tags: z.array(z.string().min(1).max(64)).default([]),
  provenance: provenanceSchema,
})

export type Capability = z.infer<typeof capabilitySchema>
