import type { Provenance, Reference } from '@element-plus/contracts'

/**
 * Build a provenance record for a registry mutation performed by a user.
 * `derivedFrom` carries lineage back to, e.g., the ProblemSpecification that
 * motivated the object.
 */
export function makeProvenance(input: {
  actorUserId: string
  derivedFrom?: Reference[]
  reason: string
  createdAt: string
}): Provenance {
  return {
    actor: { id: input.actorUserId, kind: 'user' },
    createdAt: input.createdAt,
    derivedFrom: input.derivedFrom ?? [],
    reason: input.reason,
    source: 'system',
  }
}
