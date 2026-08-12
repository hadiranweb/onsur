import { z } from 'zod'
import { idSchema, referenceSchema, versionSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Asset: a distributable, versioned capability package (Island, Process,
 * Skill, Template, KnowledgePackage, EvaluationPack, or Dataset).
 *
 * Dataset is a valid asset type but must NOT be publicly publishable without
 * explicit rights metadata and safeguards (enforced in Sprint 11).
 */

export const assetKindSchema = z.enum([
  'island',
  'process',
  'skill',
  'template',
  'knowledge_package',
  'evaluation_pack',
  'dataset',
])

export type AssetKind = z.infer<typeof assetKindSchema>

export const assetVisibilitySchema = z.enum(['private', 'workspace', 'public'])

export type AssetVisibility = z.infer<typeof assetVisibilitySchema>

export const assetSchema = z.object({
  id: idSchema,
  kind: assetKindSchema,
  version: versionSchema,
  owner: referenceSchema,
  visibility: assetVisibilitySchema,
  license: z.string().min(1).max(200),
  contentRef: referenceSchema,
  provenance: provenanceSchema,
})

export type Asset = z.infer<typeof assetSchema>
