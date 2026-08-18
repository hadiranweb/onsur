import { randomUUID } from 'node:crypto'
import { bumpPatch, canSpsTransition, nextSpsState } from '@element-plus/domain'
import { structuredProblemOutputSchema } from '@element-plus/contracts'
import type { Provenance, StructuredProblemOutput } from '@element-plus/contracts'
import { AppError } from '../errors'
import type {
  ProblemRecord,
  ProblemRepository,
  ProblemSpecificationRecord,
  ProblemSpecificationRepository,
  SpsMessageRecord,
  SpsRepository,
  SpsSessionRecord,
  StructuredLlmPort,
  UserRecord,
} from '../ports'
import type { WorkspaceService } from './workspace-service'

export interface FounderServiceDeps {
  problems: ProblemRepository
  specifications: ProblemSpecificationRepository
  sps: SpsRepository
  llm: StructuredLlmPort
  workspaces: WorkspaceService
  now?: () => Date
}

export interface FounderSessionView {
  session: SpsSessionRecord
  problem: ProblemRecord
  messages: SpsMessageRecord[]
  draft: ProblemSpecificationRecord | null
  confirmed: ProblemSpecificationRecord | null
}

export class FounderService {
  private readonly now: () => Date

  constructor(private readonly deps: FounderServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /**
   * Open a Founder SPS session for a raw problem, run the (fake or real)
   * structured LLM, validate its output, and leave the session in `review`
   * with a draft ProblemSpecification.
   */
  async start(
    user: UserRecord,
    workspaceId: string,
    rawProblem: string,
  ): Promise<FounderSessionView> {
    await this.deps.workspaces.assertAccess(user.id, workspaceId)

    const trimmed = rawProblem.trim()
    if (trimmed.length === 0) {
      throw new AppError('INVALID_INPUT', 'raw problem must not be empty')
    }

    const problemId = randomUUID()
    const problem = await this.deps.problems.create({
      id: problemId,
      workspaceId,
      rawProblem: trimmed,
    })

    const sessionId = randomUUID()
    await this.deps.sps.createSession({ id: sessionId, workspaceId, problemId })
    await this.deps.sps.addMessage({
      id: randomUUID(),
      sessionId,
      role: 'user',
      content: trimmed,
    })

    await this.transition(sessionId, 'submit') // open -> structuring
    const output = await this.structureWithValidation({ rawProblem: trimmed, corrections: [] })
    await this.persistDraft(problem, output, '1.0.0', 'draft', user.id)
    await this.deps.sps.addMessage({
      id: randomUUID(),
      sessionId,
      role: 'assistant',
      content: output.structuredUnderstanding,
    })
    await this.transition(sessionId, 'produced') // structuring -> review

    return this.view(user, workspaceId, sessionId)
  }

  /**
   * Apply a user correction: re-structure with the correction context and
   * produce the next draft version. The prior draft is preserved (not mutated).
   */
  async correct(
    user: UserRecord,
    workspaceId: string,
    sessionId: string,
    correction: string,
  ): Promise<FounderSessionView> {
    const { problem } = await this.loadAuthorized(user, workspaceId, sessionId)

    const trimmed = correction.trim()
    if (trimmed.length === 0) {
      throw new AppError('INVALID_INPUT', 'correction must not be empty')
    }

    await this.transition(sessionId, 'correct') // review -> structuring

    const corrections = await this.collectCorrections(sessionId)
    corrections.push(trimmed)

    await this.deps.sps.addMessage({
      id: randomUUID(),
      sessionId,
      role: 'user',
      content: `Correction: ${trimmed}`,
    })

    const output = await this.structureWithValidation({
      rawProblem: problem.rawProblem,
      corrections,
    })

    const latest = await this.deps.specifications.findLatestByProblem(problem.id)
    const nextVersion = latest ? bumpPatch(latest.version) : '1.0.0'
    await this.persistDraft(problem, output, nextVersion, 'draft', user.id)

    await this.deps.sps.addMessage({
      id: randomUUID(),
      sessionId,
      role: 'assistant',
      content: output.structuredUnderstanding,
    })
    await this.transition(sessionId, 'produced') // structuring -> review

    return this.view(user, workspaceId, sessionId)
  }

  /**
   * Confirm the current draft: the ProblemSpecification becomes a versioned,
   * published object (status `confirmed`). The session becomes terminal.
   */
  async confirm(
    user: UserRecord,
    workspaceId: string,
    sessionId: string,
  ): Promise<FounderSessionView> {
    const { problem } = await this.loadAuthorized(user, workspaceId, sessionId)

    await this.transition(sessionId, 'confirm') // review -> confirmed

    const draft = await this.deps.specifications.findLatestByProblem(problem.id)
    if (!draft || draft.status !== 'draft') {
      throw new AppError('CONFLICT', 'no draft ProblemSpecification to confirm')
    }

    await this.deps.specifications.updateStatus(draft.id, 'confirmed')

    return this.view(user, workspaceId, sessionId)
  }

  /** Read a Founder session (authorized). */
  async get(user: UserRecord, workspaceId: string, sessionId: string): Promise<FounderSessionView> {
    return this.view(user, workspaceId, sessionId)
  }

  /** List SPS sessions in a workspace (authorized). */
  async list(user: UserRecord, workspaceId: string): Promise<SpsSessionRecord[]> {
    await this.deps.workspaces.assertAccess(user.id, workspaceId)
    return this.deps.sps.listSessionsByWorkspace(workspaceId)
  }

  // -------------------------------------------------------------------------

  private async loadAuthorized(
    user: UserRecord,
    workspaceId: string,
    sessionId: string,
  ): Promise<{ session: SpsSessionRecord; problem: ProblemRecord }> {
    await this.deps.workspaces.assertAccess(user.id, workspaceId)

    const session = await this.deps.sps.findSessionById(sessionId)
    if (!session || session.workspaceId !== workspaceId) {
      throw new AppError('NOT_FOUND', 'SPS session not found')
    }
    const problem = await this.deps.problems.findById(session.problemId)
    if (!problem) {
      throw new AppError('NOT_FOUND', 'problem not found')
    }
    return { session, problem }
  }

  private async view(
    user: UserRecord,
    workspaceId: string,
    sessionId: string,
  ): Promise<FounderSessionView> {
    const { session, problem } = await this.loadAuthorized(user, workspaceId, sessionId)
    const messages = await this.deps.sps.listMessages(sessionId)
    const draft = await this.deps.specifications.findLatestByProblem(problem.id)
    const confirmed = await this.deps.specifications.findConfirmedByProblem(problem.id)
    return {
      session,
      problem,
      messages,
      draft: draft && draft.status === 'draft' ? draft : null,
      confirmed: confirmed && confirmed.status === 'confirmed' ? confirmed : null,
    }
  }

  private async transition(
    sessionId: string,
    event: 'submit' | 'produced' | 'correct' | 'confirm' | 'fail',
  ) {
    const session = await this.deps.sps.findSessionById(sessionId)
    if (!session) {
      throw new AppError('NOT_FOUND', 'SPS session not found')
    }
    if (!canSpsTransition(session.status, event)) {
      throw new AppError('CONFLICT', `SPS session cannot ${event} from status ${session.status}`)
    }
    const next = nextSpsState(session.status, event)
    await this.deps.sps.updateStatus(sessionId, next)
  }

  private async structureWithValidation(request: {
    rawProblem: string
    corrections: string[]
  }): Promise<StructuredProblemOutput> {
    const output = await this.deps.llm.structure(request)
    const parsed = structuredProblemOutputSchema.safeParse(output)
    if (!parsed.success) {
      throw new AppError('MODEL_OUTPUT_INVALID', 'structured model output failed schema validation')
    }
    return parsed.data
  }

  private async collectCorrections(sessionId: string): Promise<string[]> {
    const messages = await this.deps.sps.listMessages(sessionId)
    return messages
      .filter((message) => message.role === 'user' && message.content.startsWith('Correction: '))
      .map((message) => message.content.slice('Correction: '.length))
  }

  private async persistDraft(
    problem: ProblemRecord,
    output: StructuredProblemOutput,
    version: string,
    status: 'draft' | 'confirmed',
    actorUserId: string,
  ): Promise<ProblemSpecificationRecord> {
    const provenance: Provenance = {
      actor: { id: actorUserId, kind: 'user' },
      createdAt: this.now().toISOString(),
      derivedFrom: [],
      reason:
        status === 'confirmed' ? 'user confirmed the structured understanding' : 'structured draft',
      source: 'system',
    }
    return this.deps.specifications.create({
      id: randomUUID(),
      problemId: problem.id,
      workspaceId: problem.workspaceId,
      version,
      status,
      rawProblem: problem.rawProblem,
      structuredUnderstanding: output.structuredUnderstanding,
      items: output.items,
      successCriteria: output.successCriteria,
      constraints: output.constraints,
      provenance,
    })
  }
}
