import { randomUUID } from 'node:crypto'
import { canAccessWorkspace } from '@element-plus/domain'
import type { CreateWorkspaceInput, WorkspaceRole } from '@element-plus/contracts'
import { AppError, UniqueViolationError } from '../errors'
import type {
  MembershipRecord,
  MembershipRepository,
  UserRecord,
  WorkspaceRecord,
  WorkspaceRepository,
} from '../ports'

export interface WorkspaceAccess {
  workspace: WorkspaceRecord
  role: WorkspaceRole
}

export interface WorkspaceServiceDeps {
  workspaces: WorkspaceRepository
  memberships: MembershipRepository
}

export class WorkspaceService {
  constructor(private readonly deps: WorkspaceServiceDeps) {}

  /**
   * Idempotently create the user's personal workspace. Calling this twice for
   * the same user returns the same workspace (never a duplicate).
   */
  async createPersonalWorkspace(user: UserRecord): Promise<WorkspaceRecord> {
    const existing = await this.deps.workspaces.findPersonalByOwner(user.id)
    if (existing) {
      return existing
    }

    const id = randomUUID()
    const workspace = await this.createWithOwner({
      id,
      slug: `personal-${user.id}`,
      name: `${user.displayName}'s workspace`,
      kind: 'personal',
      ownerUserId: user.id,
    })
    return workspace
  }

  async createTeamWorkspace(
    user: UserRecord,
    input: CreateWorkspaceInput,
  ): Promise<WorkspaceRecord> {
    const existing = await this.deps.workspaces.findBySlug(input.slug)
    if (existing) {
      throw new AppError('CONFLICT', `workspace slug "${input.slug}" is already taken`)
    }
    return this.createWithOwner({
      id: randomUUID(),
      slug: input.slug,
      name: input.name,
      kind: 'team',
      ownerUserId: user.id,
    })
  }

  /** Lists workspaces the user is a member of, with their role. */
  async listForUser(userId: string): Promise<WorkspaceAccess[]> {
    const memberships = await this.deps.memberships.listByUser(userId)
    const result: WorkspaceAccess[] = []
    for (const membership of memberships) {
      const workspace = await this.deps.workspaces.findById(membership.workspaceId)
      if (workspace) {
        result.push({ workspace, role: membership.role })
      }
    }
    return result
  }

  /** Returns the workspace + membership role, or null when not a member. */
  async getForUser(userId: string, workspaceId: string): Promise<WorkspaceAccess | null> {
    const membership = await this.deps.memberships.findByWorkspaceAndUser(workspaceId, userId)
    if (!membership) {
      return null
    }
    const workspace = await this.deps.workspaces.findById(workspaceId)
    if (!workspace) {
      return null
    }
    return { workspace, role: membership.role }
  }

  /**
   * Server-side workspace authorization: default deny. Throws FORBIDDEN when
   * the user has no membership with at least `requiredRole`.
   */
  async assertAccess(
    userId: string,
    workspaceId: string,
    requiredRole: WorkspaceRole = 'member',
  ): Promise<WorkspaceAccess> {
    const membership = await this.deps.memberships.findByWorkspaceAndUser(workspaceId, userId)
    if (!canAccessWorkspace(membership, requiredRole)) {
      throw new AppError('FORBIDDEN', 'workspace access denied')
    }
    const workspace = await this.deps.workspaces.findById(workspaceId)
    if (!workspace) {
      throw new AppError('FORBIDDEN', 'workspace access denied')
    }
    return { workspace, role: membership!.role }
  }

  private async createWithOwner(input: {
    id: string
    slug: string
    name: string
    kind: 'personal' | 'team'
    ownerUserId: string
  }): Promise<WorkspaceRecord> {
    try {
      const workspace = await this.deps.workspaces.create(input)
      await this.deps.memberships.create({
        workspaceId: workspace.id,
        userId: input.ownerUserId,
        role: 'owner',
      })
      return workspace
    } catch (error) {
      if (error instanceof UniqueViolationError) {
        // Race: someone else created the same personal workspace. Re-fetch.
        const existing = await this.deps.workspaces.findPersonalByOwner(input.ownerUserId)
        if (existing) {
          return existing
        }
        throw new AppError('CONFLICT', `workspace slug "${input.slug}" is already taken`)
      }
      throw error
    }
  }

  /** Expose membership lookup for other services (e.g. tests). */
  getMembership(workspaceId: string, userId: string): Promise<MembershipRecord | null> {
    return this.deps.memberships.findByWorkspaceAndUser(workspaceId, userId)
  }
}
