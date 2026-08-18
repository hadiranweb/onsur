/**
 * Resource authority vocabulary (pure).
 *
 * Element Plus is a network of users/workspaces/islands/processes/assets;
 * cross-workspace access is NOT globally prohibited. The invariant is narrower:
 *
 *   cross-workspace access WITHOUT an explicit authorized relationship is
 *   forbidden.
 *
 * v1 resolves only the local relationships below; the remaining values are a
 * future-compatible extension seam (installed / shared / delegated / public /
 * contractual). Resolution of relationships happens in the application layer
 * (ResourceAccessService), which queries indexed relationships — never by
 * scanning the global network.
 */

export type ResourceRelationship =
  'owned' | 'network' | 'installed' | 'shared' | 'delegated' | 'public' | 'contractual'

export type ResourceAction = 'execute' | 'read' | 'cancel' | 'approve' | 'evaluate'

/**
 * Default deny. An action is authorized only when an explicit positive
 * relationship has been resolved; `null` means "no relationship".
 */
export function isAccessAllowed(relationship: ResourceRelationship | null): boolean {
  return relationship !== null
}

/** The v1 relationships an actor can currently resolve locally. */
export const LOCAL_RELATIONSHIPS: readonly ResourceRelationship[] = ['owned', 'network']
