import { isAccessAllowed } from '@element-plus/domain'
import type { ResourceAction, ResourceRelationship } from '@element-plus/domain'
import type { Reference } from '@element-plus/contracts'
import { AppError } from '../errors'
import type { ProblemSpecificationRepository, RunRecord, RunRepository } from '../ports'
import type { WorkspaceService } from './workspace-service'

/**
 * The reusable execution/resource authority boundary.
 *
 * Conceptual chain: Actor → Acting Workspace → Resource → Ownership →
 * Access Relationship → Authority → Policy → Action.
 *
 * v1 resolves the local relationships (`owned` for workspace-scoped subjects,
 * `network` for the intentionally global Process/Island registries). Any
 * subject/actor relationship that is not locally resolved is DENIED — future
 * relationships (installed / shared / delegated / public / contractual) are
 * added here, not scattered across routes.
 */
export interface ResourceAccessDeps {
  specifications: ProblemSpecificationRepository
  runs: RunRepository
  workspaces: WorkspaceService
}

export class ResourceAccessService {
  constructor(private readonly deps: ResourceAccessDeps) {}

  /**
   * Assert that an actor may perform `action` on `subject` while acting within
   * `actingWorkspaceId`. Default deny: no resolved relationship → FORBIDDEN.
   */
  async assertCanAccessSubject(
    actorUserId: string,
    actingWorkspaceId: string,
    subject: Reference,
    action: ResourceAction,
  ): Promise<void> {
    // 1. The actor must be able to act within the acting workspace.
    await this.deps.workspaces.assertAccess(actorUserId, actingWorkspaceId)

    // 2. Resolve the subject relationship (bounded, indexed lookups only).
    const relationship = await this.resolveSubjectRelationship(actingWorkspaceId, subject)

    // 3. Default deny.
    if (!isAccessAllowed(relationship)) {
      throw new AppError(
        'FORBIDDEN',
        `no authorized relationship to ${action} ${subject.kind}:${subject.id}`,
      )
    }
  }

  /** Resolve the relationship an acting workspace has to a subject. */
  async resolveSubjectRelationship(
    actingWorkspaceId: string,
    subject: Reference,
  ): Promise<ResourceRelationship | null> {
    switch (subject.kind) {
      case 'problem_specification': {
        const spec = await this.deps.specifications.findById(subject.id)
        if (!spec) {
          return null
        }
        // v1 local rule: the owning workspace is the only authorized executor.
        if (spec.workspaceId === actingWorkspaceId) {
          return 'owned'
        }
        // FUTURE seam: evaluate explicit installs/shares/delegations here.
        return null
      }
      case 'process':
      case 'island':
        // v1: Process/Island registries are intentionally global network
        // resources (reuse-before-create). Their execution remains bounded by
        // the Run's execution workspace, which scopes all derived data.
        return 'network'
      default:
        return null
    }
  }

  /**
   * Assert an actor may perform `action` on a Run. Authority derives from the
   * Run's explicit execution workspace; a Run with no workspace fails closed.
   */
  async assertCanAccessRun(
    actorUserId: string,
    runId: string,
    action: ResourceAction,
  ): Promise<RunRecord> {
    const run = await this.deps.runs.findById(runId)
    if (!run) {
      throw new AppError('NOT_FOUND', 'run not found')
    }
    if (!run.workspaceId) {
      // Legacy/unbackfilled run with no authoritative workspace: deny.
      throw new AppError('FORBIDDEN', `run has no authorized workspace to ${action}`)
    }
    await this.deps.workspaces.assertAccess(actorUserId, run.workspaceId)
    return run
  }

  /** The workspaces an actor may act within (bounded by their memberships). */
  async workspaceIdsForUser(userId: string): Promise<string[]> {
    const accesses = await this.deps.workspaces.listForUser(userId)
    return accesses.map((access) => access.workspace.id)
  }
}
