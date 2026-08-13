import { randomUUID } from 'node:crypto'
import { canFeedbackTransition, nextFeedbackState } from '@element-plus/domain'
import type { FeedbackEvent } from '@element-plus/contracts'
import { AppError } from '../errors'
import type {
  FeedbackRecord,
  FeedbackRepository,
  ProblemSpecificationRepository,
  RunRepository,
} from '../ports'
import { makeProvenance } from '../util/provenance'
import type { MemoryService } from './memory-service'
import type { WorkspaceService } from './workspace-service'

export interface SubmitFeedbackInput {
  runId: string
  content: string
  actorUserId: string
}

export interface FeedbackServiceDeps {
  feedback: FeedbackRepository
  runs: RunRepository
  specifications: ProblemSpecificationRepository
  workspaces: WorkspaceService
  memory: MemoryService
  now?: () => Date
}

export class FeedbackService {
  private readonly now: () => Date

  constructor(private readonly deps: FeedbackServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /** Submit feedback against a Run. Feedback traces to its originating run. */
  async submit(input: SubmitFeedbackInput): Promise<FeedbackRecord> {
    const scope = await this.resolveRunScope(input.runId)
    if (!scope) {
      throw new AppError('NOT_FOUND', 'run not found')
    }
    // Only workspace members may provide feedback on a run in that workspace.
    await this.deps.workspaces.assertAccess(input.actorUserId, scope.workspaceId)

    const content = input.content.trim()
    if (content.length === 0) {
      throw new AppError('INVALID_INPUT', 'feedback content must not be empty')
    }

    return this.deps.feedback.create({
      id: randomUUID(),
      runId: { id: input.runId, kind: 'run' },
      content,
      status: 'submitted',
      provenance: makeProvenance({
        actorUserId: input.actorUserId,
        derivedFrom: [{ id: input.runId, kind: 'run' }],
        reason: 'feedback submitted against run',
        createdAt: this.now().toISOString(),
      }),
    })
  }

  async triage(id: string): Promise<FeedbackRecord> {
    return this.transition(id, 'triage')
  }

  async accept(id: string): Promise<FeedbackRecord> {
    return this.transition(id, 'accept')
  }

  async reject(id: string): Promise<FeedbackRecord> {
    return this.transition(id, 'reject')
  }

  /**
   * Apply accepted feedback: the feedback content becomes a workspace-scoped
   * MemoryCandidate tracing back to the originating run (Run → Feedback →
   * MemoryCandidate).
   */
  async apply(id: string): Promise<FeedbackRecord> {
    const applied = await this.transition(id, 'apply')
    await this.deps.memory.createCandidateFromFeedback(applied.runId.id, applied.content)
    return applied
  }

  async get(id: string): Promise<FeedbackRecord> {
    return this.mustFind(id)
  }

  async listByRun(runId: string): Promise<FeedbackRecord[]> {
    return this.deps.feedback.listByRun(runId)
  }

  private async transition(id: string, event: FeedbackEvent): Promise<FeedbackRecord> {
    const feedback = await this.mustFind(id)
    if (!canFeedbackTransition(feedback.status, event)) {
      throw new AppError('CONFLICT', `feedback cannot ${event} from status ${feedback.status}`)
    }
    await this.deps.feedback.updateStatus(id, nextFeedbackState(feedback.status, event))
    return this.mustFind(id)
  }

  private async resolveRunScope(runId: string): Promise<{ workspaceId: string } | null> {
    const run = await this.deps.runs.findById(runId)
    if (!run) {
      return null
    }
    const spec = await this.deps.specifications.findById(run.snapshot.problemSpec.id)
    if (!spec) {
      return null
    }
    return { workspaceId: spec.workspaceId }
  }

  private async mustFind(id: string): Promise<FeedbackRecord> {
    const feedback = await this.deps.feedback.findById(id)
    if (!feedback) {
      throw new AppError('NOT_FOUND', `feedback ${id} not found`)
    }
    return feedback
  }
}
