import type { WorkspaceRole } from '@element-plus/contracts'

/**
 * Workspace authorization (pure rules).
 *
 * Default authorization is deny: a user with no membership has no access, and
 * a role below the required role is denied. Enforcement is a server-side
 * concern; these predicates are the pure decision core.
 */

const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 2,
  member: 1,
}

export function roleAtLeast(role: WorkspaceRole, required: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required]
}

export interface MembershipLike {
  role: WorkspaceRole
}

/**
 * Default-deny workspace access: no membership => deny; insufficient role =>
 * deny.
 */
export function canAccessWorkspace(
  membership: MembershipLike | null | undefined,
  required: WorkspaceRole = 'member',
): boolean {
  if (!membership) {
    return false
  }
  return roleAtLeast(membership.role, required)
}

export function isWorkspaceOwner(membership: MembershipLike | null | undefined): boolean {
  return membership?.role === 'owner'
}
