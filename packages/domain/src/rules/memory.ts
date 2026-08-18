import type { MemoryScope } from '@element-plus/contracts'
import type { MembershipLike } from './workspace'

/**
 * Scoped memory authorization (default deny).
 *
 *   private:   owner only (read and write)
 *   workspace: members of the owning workspace (read and write)
 *   shared:    members write; any authenticated user may read
 *
 * A user with no membership can neither read nor write workspace-scoped memory;
 * cross-workspace retrieval of a workspace-scoped entry is therefore denied by
 * construction.
 */

export function canWriteMemory(input: {
  scope: MemoryScope
  ownerId: string
  requesterId: string
  membership: MembershipLike | null
}): boolean {
  if (input.scope === 'private') {
    return input.requesterId === input.ownerId
  }
  return input.membership != null
}

export function canReadMemory(input: {
  scope: MemoryScope
  ownerId: string
  requesterId: string
  membership: MembershipLike | null
  isAuthenticated: boolean
}): boolean {
  if (input.scope === 'private') {
    return input.requesterId === input.ownerId
  }
  if (input.scope === 'shared') {
    return input.isAuthenticated
  }
  return input.membership != null
}
