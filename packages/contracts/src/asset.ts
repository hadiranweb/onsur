import { z } from 'zod'
import { idSchema, referenceSchema, versionSchema } from './ids'
import { provenanceSchema } from './provenance'

/**
 * Asset: a distributable, versioned capability package (Island, Process,
 * Skill, Template, KnowledgePackage, EvaluationPack, or Dataset).
 *
 * Dataset is a valid asset type but must NOT be publicly publishable without
 * explicit rights metadata and safeguards (enforced at publication time).
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
  version: versionSchema,
  kind: assetKindSchema,
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  tags: z.array(z.string().min(1).max(64)).default([]),
  owner: referenceSchema,
  visibility: assetVisibilitySchema,
  license: z.string().min(1).max(200),
  contentRef: referenceSchema,
  /** Dataset publication requires this (e.g. rights holder, usage terms). */
  rights: z.record(z.string()).optional(),
  provenance: provenanceSchema,
})

export type Asset = z.infer<typeof assetSchema>

/** An install of an exact asset version into a workspace. */
export const assetInstallSchema = z.object({
  id: idSchema,
  assetId: idSchema,
  version: versionSchema,
  workspaceId: idSchema,
  installedBy: idSchema,
  provenance: provenanceSchema,
})

export type AssetInstall = z.infer<typeof assetInstallSchema>
