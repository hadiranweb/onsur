import { randomUUID } from 'node:crypto'
import { canReadMemory, canWriteMemory } from '@element-plus/domain'
import type { MemoryScope, Reference } from '@element-plus/contracts'
import { AppError } from '../errors'
import type {
  MemoryRecord,
  MemoryRepository,
  ProblemSpecificationRepository,
  RunRepository,
} from '../ports'
import { makeProvenance } from '../util/provenance'
import type { WorkspaceService } from './workspace-service'

export interface MemoryServiceDeps {
  memory: MemoryRepository
  workspaces: WorkspaceService
  runs: RunRepository
  specifications: ProblemSpecificationRepository
  now?: () => Date
}

export class MemoryService {
  private readonly now: () => Date

  constructor(private readonly deps: MemoryServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /**
   * Create a scoped memory candidate. Always `candidate`; promotion is a
   * separate authorized step and never automatic.
   */
  async createCandidate(input: {
    workspaceId: string
    ownerId: string
    scope: MemoryScope
    content: string
    actorUserId: string
    sourceRunId?: string
    tags?: string[]
  }): Promise<MemoryRecord> {
    await this.assertWrite(input.scope, input.ownerId, input.actorUserId, input.workspaceId)

    const content = input.content.trim()
    if (content.length === 0) {
      throw new AppError('INVALID_INPUT', 'memory content must not be empty')
    }

    const sourceRun: Reference | undefined = input.sourceRunId
      ? { id: input.sourceRunId, kind: 'run' }
      : undefined

    return this.deps.memory.create({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      scope: input.scope,
      content,
      tags: input.tags ?? [],
      sourceRun,
      status: 'candidate',
      provenance: makeProvenance({
        actorUserId: input.actorUserId,
        derivedFrom: sourceRun ? [sourceRun] : [],
        reason: 'memory candidate created',
        createdAt: this.now().toISOString(),
      }),
    })
  }

  /** Promote a candidate (candidate → promoted), authorized by write scope. */
  async promote(id: string, actorUserId: string): Promise<MemoryRecord> {
    const entry = await this.mustFind(id)
    await this.assertWrite(entry.scope, entry.ownerId, actorUserId, entry.workspaceId)
    if (entry.status !== 'candidate') {
      throw new AppError('CONFLICT', `memory cannot promote from status ${entry.status}`)
    }
    await this.deps.memory.updateStatus(id, 'promoted')
    return this.mustFind(id)
  }

  /** Reject a candidate (candidate → rejected), authorized by write scope. */
  async reject(id: string, actorUserId: string): Promise<MemoryRecord> {
    const entry = await this.mustFind(id)
    await this.assertWrite(entry.scope, entry.ownerId, actorUserId, entry.workspaceId)
    if (entry.status !== 'candidate') {
      throw new AppError('CONFLICT', `memory cannot reject from status ${entry.status}`)
    }
    await this.deps.memory.updateStatus(id, 'rejected')
    return this.mustFind(id)
  }

  /**
   * Memory readable by a user: their private entries, workspace entries they
   * are a member of, and shared entries (any authenticated user).
   */
  async listForUser(userId: string): Promise<MemoryRecord[]> {
    const entries: MemoryRecord[] = []
    entries.push(...(await this.deps.memory.listByOwner(userId)))
    entries.push(...(await this.deps.memory.listByScope('shared')))

    const accesses = await this.deps.workspaces.listForUser(userId)
    for (const access of accesses) {
      entries.push(...(await this.deps.memory.listByWorkspace(access.workspace.id)))
    }
    return dedupe(entries)
  }

  /** List memory in a workspace; requires membership (default deny). */
  async listWorkspace(userId: string, workspaceId: string): Promise<MemoryRecord[]> {
    await this.deps.workspaces.assertAccess(userId, workspaceId)
    return this.deps.memory.listByWorkspace(workspaceId)
  }

  /**
   * Ingest runtime memory output (e.g. OpenClaw `memoryCandidates`) as
   * candidate entries. Runtime memory NEVER promotes automatically.
   */
  async ingestRunCandidates(runId: string, candidates: string[]): Promise<void> {
    const scope = await this.resolveRunScope(runId)
    if (!scope) {
      return
    }
    for (const candidate of candidates) {
      const content = candidate.trim()
      if (!content) {
        continue
      }
      await this.deps.memory.create({
        id: randomUUID(),
        workspaceId: scope.workspaceId,
        ownerId: scope.ownerId,
        scope: 'workspace',
        content,
        tags: [],
        sourceRun: { id: runId, kind: 'run' },
        status: 'candidate',
        provenance: makeProvenance({
          actorUserId: scope.ownerId,
          derivedFrom: [{ id: runId, kind: 'run' }],
          reason: 'runtime memory candidate (not promoted)',
          createdAt: this.now().toISOString(),
        }),
      })
    }
  }

  /** Create a workspace-scoped candidate from accepted-and-applied feedback. */
  async createCandidateFromFeedback(runId: string, content: string): Promise<MemoryRecord> {
    const scope = await this.resolveRunScope(runId)
    if (!scope) {
      throw new AppError('NOT_FOUND', 'cannot resolve the run for feedback memory')
    }
    return this.createCandidate({
      workspaceId: scope.workspaceId,
      ownerId: scope.ownerId,
      scope: 'workspace',
      content,
      actorUserId: scope.ownerId,
      sourceRunId: runId,
    })
  }

  async get(id: string, actorUserId: string): Promise<MemoryRecord> {
    const entry = await this.mustFind(id)
    const membership = await this.deps.workspaces.getMembership(entry.workspaceId, actorUserId)
    const readable = canReadMemory({
      scope: entry.scope,
      ownerId: entry.ownerId,
      requesterId: actorUserId,
      membership,
      isAuthenticated: true,
    })
    if (!readable) {
      throw new AppError('FORBIDDEN', 'memory read denied')
    }
    return entry
  }

  // -------------------------------------------------------------------------

  private async assertWrite(
    scope: MemoryScope,
    ownerId: string,
    actorUserId: string,
    workspaceId: string,
  ): Promise<void> {
    const membership = await this.deps.workspaces.getMembership(workspaceId, actorUserId)
    const allowed = canWriteMemory({
      scope,
      ownerId,
      requesterId: actorUserId,
      membership,
    })
    if (!allowed) {
      throw new AppError('FORBIDDEN', 'memory write denied')
    }
  }

  private async resolveRunScope(
    runId: string,
  ): Promise<{ workspaceId: string; ownerId: string } | null> {
    const run = await this.deps.runs.findById(runId)
    if (!run) {
      return null
    }
    const spec = await this.deps.specifications.findById(run.snapshot.problemSpec.id)
    if (!spec) {
      return null
    }
    return { workspaceId: spec.workspaceId, ownerId: run.provenance.actor?.id ?? 'system' }
  }

  private async mustFind(id: string): Promise<MemoryRecord> {
    const entry = await this.deps.memory.findById(id)
    if (!entry) {
      throw new AppError('NOT_FOUND', `memory ${id} not found`)
    }
    return entry
  }
}

function dedupe(entries: MemoryRecord[]): MemoryRecord[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    if (seen.has(entry.id)) {
      return false
    }
    seen.add(entry.id)
    return true
  })
}
