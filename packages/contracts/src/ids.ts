import { z } from 'zod'

/**
 * Canonical identifier and reference contracts.
 *
 * An identifier is an opaque, non-empty string with no whitespace. References
 * pair an identifier with the kind of entity it points at; every provenance,
 * run, and knowledge record refers to other entities through `Reference`.
 */

export const idSchema = z
  .string()
  .min(1, 'id must not be empty')
  .max(128, 'id must be at most 128 characters')
  .regex(/^\S+$/, 'id must not contain whitespace')

export type Id = z.infer<typeof idSchema>

/** The set of domain entities an identifier or reference may point at. */
export const entityKindSchema = z.enum([
  'user',
  'workspace',
  'workspace_membership',
  'problem',
  'problem_specification',
  'sps_session',
  'process',
  'process_step',
  'capability',
  'island',
  'runtime_binding',
  'agent',
  'tool',
  'package',
  'run',
  'artifact',
  'evaluation',
  'feedback',
  'memory_entry',
  'knowledge',
  'version_proposal',
  'asset',
  'evidence',
  'audit_event',
])

export type EntityKind = z.infer<typeof entityKindSchema>

export const referenceSchema = z.object({
  id: idSchema,
  kind: entityKindSchema,
})

export type Reference = z.infer<typeof referenceSchema>

/** Canonical object version: strict semver (MAJOR.MINOR.PATCH). */
export const versionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'version must be semver (MAJOR.MINOR.PATCH)')

export type Version = z.infer<typeof versionSchema>

/** Canonical timestamp: ISO 8601 with timezone offset. */
export const timestampSchema = z.string().datetime({ offset: true })

export type Timestamp = z.infer<typeof timestampSchema>
