import { randomUUID } from 'node:crypto'
import {
  canRunTransition,
  isTerminalRunStatus,
  nextRunState,
  requiresApproval,
} from '@element-plus/domain'
import type {
  EffectKind,
  Evaluation,
  Island,
  Reference,
  RunEventType,
} from '@element-plus/contracts'
import { AppError } from '../errors'
import { FakeRuntimeAdapter } from '../infrastructure/fake-runtime-adapter'
import { OpenClawRuntimeAdapter } from '../openclaw/adapter'
import type { OpenClawCliConfig } from '../openclaw/cli'
import type {
  ApprovalRecord,
  ApprovalRepository,
  ArtifactRecord,
  ArtifactRepository,
  EffectRepository,
  EffectRecordRow,
  EvaluationRepository,
  ProblemSpecificationRepository,
  RuntimeAdapter,
  RuntimeError,
  RunEventRecord,
  RunRecord,
  RunRepository,
  ToolCallRecord,
  ToolCallRepository,
  ToolGate,
  ToolRegistry,
} from '../ports'
import { makeProvenance } from '../util/provenance'
import { normalizeError } from '../util/normalize-error'
import type { IslandService } from './island-service'
import type { ProcessService } from './process-service'
import type { ResourceAccessService } from './resource-access-service'

export interface EnqueueRunInput {
  actorUserId: string
  islandId: string
  problemSpecId: string
  processId?: string
}

export interface RunView {
  run: RunRecord
  events: RunEventRecord[]
  approvals: ApprovalRecord[]
  toolCalls: ToolCallRecord[]
  effects: EffectRecordRow[]
  artifacts: ArtifactRecord[]
  evaluations: Evaluation[]
}

/**
 * Runtime memory output is ingested as candidates only. Implemented by the
 * MemoryService; the run engine calls it after a run completes.
 */
export interface RunMemoryIntake {
  ingestRunCandidates(runId: string, candidates: string[]): Promise<void>
}

export interface RunEngineDeps {
  runs: RunRepository
  approvals: ApprovalRepository
  toolCalls: ToolCallRepository
  effects: EffectRepository
  artifacts: ArtifactRepository
  evaluations: EvaluationRepository
  specifications: ProblemSpecificationRepository
  registry: ToolRegistry
  islands: IslandService
  processes: ProcessService
  access: ResourceAccessService
  now?: () => Date
  runtimeFactory?: (island: Island, gate: ToolGate) => RuntimeAdapter
  openClawConfig?: OpenClawCliConfig
  memoryIntake?: RunMemoryIntake
}

type Decision = 'approved' | 'rejected' | 'cancelled'

interface DecisionEntry {
  decision: Decision
  by: string
}

export class RunEngine {
  private readonly now: () => Date
  private readonly waiters = new Map<string, (entry: DecisionEntry) => void>()
  private readonly decisions = new Map<string, DecisionEntry>()
  private readonly controllers = new Map<string, AbortController>()

  constructor(private readonly deps: RunEngineDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /** Create a Run (draft → queued) and schedule background execution. */
  async enqueue(input: EnqueueRunInput): Promise<RunRecord> {
    const problemSpec = await this.deps.specifications.findById(input.problemSpecId)
    if (!problemSpec) {
      throw new AppError('NOT_FOUND', `problem specification ${input.problemSpecId} not found`)
    }
    if (problemSpec.status !== 'confirmed') {
      throw new AppError('INVALID_INPUT', 'problem specification must be confirmed')
    }

    // The Run's execution workspace is the ProblemSpecification's owning
    // workspace (v1 local rule). Authority resolves through the reusable
    // boundary: actor membership in the workspace + an explicit subject
    // relationship. No relationship → DENY (no run, no job, no dispatch).
    const workspaceId = problemSpec.workspaceId
    await this.deps.access.assertCanAccessSubject(
      input.actorUserId,
      workspaceId,
      { id: problemSpec.id, kind: 'problem_specification' },
      'execute',
    )

    const island = await this.deps.islands.get(input.islandId)
    if (island.status !== 'active') {
      throw new AppError('INVALID_INPUT', `island ${island.id} is not active`)
    }

    const process = input.processId ? await this.deps.processes.get(input.processId) : null

    const derivedFrom: Reference[] = [
      { id: problemSpec.id, kind: 'problem_specification' },
      { id: island.id, kind: 'island' },
    ]
    if (process) {
      derivedFrom.push({ id: process.id, kind: 'process' })
    }

    const snapshot = {
      problemSpec: { id: problemSpec.id, kind: 'problem_specification' as const },
      island: { id: island.id, kind: 'island' as const },
      process: process ? { id: process.id, kind: 'process' as const } : undefined,
      createdAt: this.now().toISOString(),
    }

    const run = await this.deps.runs.create({
      id: randomUUID(),
      workspaceId,
      status: 'draft',
      snapshot,
      provenance: makeProvenance({
        actorUserId: input.actorUserId,
        derivedFrom,
        reason: `enqueued run for island "${island.name}"`,
        createdAt: this.now().toISOString(),
      }),
      createdAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    })

    await this.appendEvent(run.id, 'enqueue', { island: island.name })
    await this.transition(run.id, 'enqueue') // draft -> queued

    this.schedule(run.id)
    return this.mustRun(run.id)
  }

  /** The full, authorized view of a run (timeline, approvals, effects, ...). */
  async get(user: { id: string }, runId: string): Promise<RunView> {
    await this.deps.access.assertCanAccessRun(user.id, runId, 'read')
    const [events, approvals, toolCalls, effects, artifacts, evaluations] = await Promise.all([
      this.deps.runs.listEvents(runId),
      this.deps.approvals.listByRun(runId),
      this.deps.toolCalls.listByRun(runId),
      this.deps.effects.listByRun(runId),
      this.deps.artifacts.listByRun(runId),
      this.deps.evaluations.listByRun(runId),
    ])
    const run = await this.mustRun(runId)
    return { run, events, approvals, toolCalls, effects, artifacts, evaluations }
  }

  /** Runs visible to a user, scoped to their workspaces (bounded queries). */
  async list(user: { id: string }): Promise<RunRecord[]> {
    const workspaceIds = await this.deps.access.workspaceIdsForUser(user.id)
    const runs: RunRecord[] = []
    for (const workspaceId of workspaceIds) {
      runs.push(...(await this.deps.runs.listByWorkspace(workspaceId)))
    }
    return runs
  }

  /** Runs that are still executing (queued / running / awaiting_approval). */
  async listActive(user: { id: string }): Promise<RunRecord[]> {
    const runs = await this.list(user)
    return runs.filter(
      (run) =>
        run.status === 'queued' || run.status === 'running' || run.status === 'awaiting_approval',
    )
  }

  /** Recently finished runs (completed / failed / cancelled). */
  async listRecent(user: { id: string }): Promise<RunRecord[]> {
    const runs = await this.list(user)
    return runs.filter(
      (run) => run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled',
    )
  }

  /** Pending approvals across the user's awaiting runs (for Mission Control). */
  async listPendingApprovals(user: {
    id: string
  }): Promise<
    Array<{ run: RunRecord; approval: ApprovalRecord; toolCall: ToolCallRecord | null }>
  > {
    const runs = await this.list(user)
    const result: Array<{
      run: RunRecord
      approval: ApprovalRecord
      toolCall: ToolCallRecord | null
    }> = []
    for (const run of runs) {
      if (run.status !== 'awaiting_approval') {
        continue
      }
      const approvals = (await this.deps.approvals.listByRun(run.id)).filter(
        (approval) => approval.status === 'pending',
      )
      for (const approval of approvals) {
        const toolCall = await this.deps.toolCalls.findById(approval.toolCallId)
        result.push({ run, approval, toolCall })
      }
    }
    return result
  }

  /**
   * Run recovery: mark stale non-terminal runs as terminal after a process
   * crash or scheduler outage. Queued/awaiting runs are cancelled; running
   * runs are failed. Pending approvals are rejected so nothing executes later.
   */
  async recoverStaleRuns(options: { staleAfterMs?: number } = {}): Promise<number> {
    const staleAfterMs = options.staleAfterMs ?? 30 * 60 * 1000
    const runs = await this.deps.runs.list()
    let recovered = 0
    for (const run of runs) {
      if (
        run.status !== 'queued' &&
        run.status !== 'running' &&
        run.status !== 'awaiting_approval'
      ) {
        continue
      }
      const updatedAt = new Date(run.updatedAt).getTime()
      if (this.now().getTime() - updatedAt <= staleAfterMs) {
        continue
      }

      const pendingApprovals = (await this.deps.approvals.listByRun(run.id)).filter(
        (approval) => approval.status === 'pending',
      )
      for (const approval of pendingApprovals) {
        await this.deps.approvals.decide(approval.id, 'rejected', 'system')
        await this.deps.toolCalls.updateStatus(approval.toolCallId, 'rejected')
      }

      const event = run.status === 'running' ? 'fail' : 'cancel'
      await this.appendEvent(run.id, event, {
        error: { code: 'RECOVERY', message: 'run recovered after stale timeout' },
      })
      await this.transition(run.id, event)
      recovered += 1
    }
    return recovered
  }

  /** Approve or reject a pending approval (default deny: only `approve` grants). */
  async decideApproval(
    user: { id: string },
    runId: string,
    approvalId: string,
    decision: 'approve' | 'reject',
  ): Promise<ApprovalRecord> {
    await this.deps.access.assertCanAccessRun(user.id, runId, 'approve')
    const approval = await this.deps.approvals.findById(approvalId)
    if (!approval || approval.runId !== runId) {
      throw new AppError('NOT_FOUND', 'approval not found')
    }
    if (approval.status !== 'pending') {
      throw new AppError('CONFLICT', 'approval already decided')
    }
    const run = await this.mustRun(runId)
    if (run.status !== 'awaiting_approval') {
      throw new AppError('CONFLICT', 'run is not awaiting approval')
    }
    this.resolveDecision(approvalId, decision === 'approve' ? 'approved' : 'rejected', user.id)
    const refreshed = await this.deps.approvals.findById(approvalId)
    if (!refreshed) {
      throw new AppError('NOT_FOUND', 'approval not found')
    }
    return refreshed
  }

  /** Cancel a run from any non-terminal state. */
  async cancel(user: { id: string }, runId: string): Promise<RunRecord> {
    const run = await this.deps.access.assertCanAccessRun(user.id, runId, 'cancel')
    if (!canRunTransition(run.status, 'cancel')) {
      throw new AppError('CONFLICT', `run cannot be cancelled from status ${run.status}`)
    }

    if (run.status === 'awaiting_approval') {
      const pending = (await this.deps.approvals.listByRun(runId)).filter(
        (approval) => approval.status === 'pending',
      )
      for (const approval of pending) {
        this.resolveDecision(approval.id, 'cancelled', user.id)
      }
      // The resumed gate transitions the run to cancelled.
      return this.mustRun(runId)
    }

    // Abort the active runtime adapter (e.g. kill the OpenClaw subprocess).
    this.controllers.get(runId)?.abort()
    await this.appendEvent(runId, 'cancel', {})
    await this.transition(runId, 'cancel')
    return this.mustRun(runId)
  }

  /** Evaluate a completed run. */
  async evaluate(
    user: { id: string },
    runId: string,
    input: { verdict: Evaluation['verdict']; score?: number; criteria?: Evaluation['criteria'] },
  ): Promise<Evaluation> {
    const run = await this.deps.access.assertCanAccessRun(user.id, runId, 'evaluate')
    if (run.status !== 'completed') {
      throw new AppError('CONFLICT', 'only completed runs can be evaluated')
    }
    return this.deps.evaluations.create({
      id: randomUUID(),
      runId: { id: runId, kind: 'run' },
      verdict: input.verdict,
      score: input.score,
      criteria: input.criteria ?? [],
      provenance: makeProvenance({
        actorUserId: user.id,
        derivedFrom: [{ id: runId, kind: 'run' }],
        reason: 'run evaluated',
        createdAt: this.now().toISOString(),
      }),
    })
  }

  // -------------------------------------------------------------------------
  // Background execution
  // -------------------------------------------------------------------------

  private schedule(runId: string): void {
    void this.execute(runId).catch((error: unknown) => {
      void this.failRun(runId, normalizeError(error))
    })
  }

  private async execute(runId: string): Promise<void> {
    const run = await this.mustRun(runId)
    const snapshot = run.snapshot

    const island = await this.deps.islands.get(snapshot.island.id)
    const problemSpec = await this.deps.specifications.findById(snapshot.problemSpec.id)
    if (!problemSpec) {
      await this.failRun(runId, { code: 'NOT_FOUND', message: 'problem specification missing' })
      return
    }
    const process = snapshot.process
      ? await this.deps.processes.get(snapshot.process.id).catch(() => null)
      : null

    await this.appendEvent(runId, 'start', {})
    await this.transition(runId, 'start') // queued -> running

    const gate: ToolGate = {
      request: (request) => this.gateRequest(runId, request),
    }

    const controller = new AbortController()
    this.controllers.set(runId, controller)

    const adapter = this.deps.runtimeFactory
      ? this.deps.runtimeFactory(island, gate)
      : defaultRuntimeFactory(island, gate, this.deps.openClawConfig)

    try {
      for await (const event of adapter.start({
        runId,
        island,
        process,
        problemSpec,
        signal: controller.signal,
      })) {
        switch (event.type) {
          case 'started':
            break
          case 'log':
            await this.appendEvent(runId, 'log', { message: event.message })
            break
          case 'tool_result':
            await this.recordToolResult(runId, event.toolCallId)
            break
          case 'completed': {
            const current = await this.deps.runs.findById(runId)
            if (current && isTerminalRunStatus(current.status)) {
              return
            }
            await this.persistResultArtifact(runId, event.result)
            const candidates = extractMemoryCandidates(event.result)
            if (candidates.length > 0 && this.deps.memoryIntake) {
              await this.deps.memoryIntake.ingestRunCandidates(runId, candidates)
            }
            await this.appendEvent(runId, 'complete', {})
            await this.transition(runId, 'complete')
            return
          }
          case 'failed': {
            const current = await this.deps.runs.findById(runId)
            if (current && isTerminalRunStatus(current.status)) {
              return
            }
            await this.appendEvent(runId, 'fail', { error: normalizeError(event.error) })
            await this.transition(runId, 'fail')
            return
          }
        }
      }
      // Runtime ended without a terminal event.
      await this.failRun(runId, {
        code: 'RUNTIME_ENDED',
        message: 'runtime ended without a terminal event',
      })
    } catch (error) {
      await this.failRun(runId, normalizeError(error))
    } finally {
      this.controllers.delete(runId)
    }
  }

  private async gateRequest(
    runId: string,
    request: { toolId: string; arguments: Record<string, unknown> },
  ): Promise<{
    allowed: boolean
    reason?: 'denied' | 'rejected' | 'cancelled'
    toolCallId: string
  }> {
    const contract = this.deps.registry.get(request.toolId)
    const toolCallId = randomUUID()

    if (!contract) {
      // Default deny: an unknown tool can never execute.
      await this.deps.toolCalls.create({
        id: toolCallId,
        runId,
        toolId: request.toolId,
        toolName: request.toolId,
        arguments: request.arguments,
        effectKind: 'read_only',
        requiresApproval: true,
        status: 'denied',
      })
      await this.appendEvent(runId, 'log', {
        message: `tool "${request.toolId}" denied: no tool contract`,
      })
      return { allowed: false, reason: 'denied', toolCallId }
    }

    const effectKind: EffectKind = contract.effectKind
    const needsApproval = requiresApproval(effectKind, contract.requiresApproval)

    await this.deps.toolCalls.create({
      id: toolCallId,
      runId,
      toolId: contract.id,
      toolName: contract.name,
      arguments: request.arguments,
      effectKind,
      requiresApproval: needsApproval,
      status: 'requested',
    })

    if (!needsApproval) {
      await this.deps.toolCalls.updateStatus(toolCallId, 'executed')
      return { allowed: true, toolCallId }
    }

    // Irreversible / approval-required effect: pause and create an Approval.
    const approvalId = randomUUID()
    await this.deps.approvals.create({
      id: approvalId,
      runId,
      toolCallId,
      effectKind,
      status: 'pending',
      decidedAt: null,
      decidedBy: null,
    })
    await this.appendEvent(runId, 'request_approval', {
      approvalId,
      toolCallId,
      toolName: contract.name,
      effectKind,
    })
    await this.transition(runId, 'request_approval') // running -> awaiting_approval

    const entry = await this.waitForDecision(approvalId)

    if (entry.decision === 'approved') {
      await this.deps.approvals.decide(approvalId, 'approved', entry.by)
      await this.deps.toolCalls.updateStatus(toolCallId, 'approved')
      await this.appendEvent(runId, 'approve', { approvalId, toolCallId })
      await this.transition(runId, 'approve') // awaiting_approval -> running
      return { allowed: true, toolCallId }
    }

    if (entry.decision === 'rejected') {
      await this.deps.approvals.decide(approvalId, 'rejected', entry.by)
      await this.deps.toolCalls.updateStatus(toolCallId, 'rejected')
      await this.appendEvent(runId, 'reject', { approvalId, toolCallId })
      await this.transition(runId, 'reject') // awaiting_approval -> running
      return { allowed: false, reason: 'rejected', toolCallId }
    }

    // cancelled
    await this.deps.toolCalls.updateStatus(toolCallId, 'denied')
    await this.appendEvent(runId, 'cancel', { approvalId, toolCallId })
    await this.transition(runId, 'cancel') // awaiting_approval -> cancelled
    return { allowed: false, reason: 'cancelled', toolCallId }
  }

  private async recordToolResult(runId: string, toolCallId: string): Promise<void> {
    const toolCall = await this.deps.toolCalls.findById(toolCallId)
    if (!toolCall) {
      return
    }
    await this.deps.toolCalls.updateStatus(toolCall.id, 'executed')
    if (toolCall.effectKind !== 'read_only') {
      await this.deps.effects.create({
        id: randomUUID(),
        runId,
        toolCallId: toolCall.id,
        kind: toolCall.effectKind,
        description: `${toolCall.toolName} executed`,
        reverted: false,
      })
    }
  }

  private async persistResultArtifact(runId: string, result: unknown): Promise<void> {
    const serialized = JSON.stringify(result)
    await this.deps.artifacts.create({
      id: randomUUID(),
      runId,
      kind: 'result',
      mimeType: 'application/json',
      sizeBytes: Buffer.byteLength(serialized, 'utf8'),
      data: result,
      provenance: makeProvenance({
        actorUserId: 'system',
        derivedFrom: [{ id: runId, kind: 'run' }],
        reason: 'run result artifact',
        createdAt: this.now().toISOString(),
      }),
    })
  }

  private async failRun(runId: string, error: RuntimeError): Promise<void> {
    const run = await this.deps.runs.findById(runId)
    if (!run || isTerminalRunStatus(run.status)) {
      return
    }
    await this.appendEvent(runId, 'fail', { error })
    await this.transition(runId, 'fail')
  }

  private async appendEvent(
    runId: string,
    type: RunEventType,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.deps.runs.appendEvent({ runId, type, payload })
  }

  private async transition(runId: string, event: RunEventType): Promise<void> {
    const run = await this.deps.runs.findById(runId)
    if (!run || !canRunTransition(run.status, event)) {
      return
    }
    await this.deps.runs.updateStatus(runId, nextRunState(run.status, event))
  }

  private async mustRun(runId: string): Promise<RunRecord> {
    const run = await this.deps.runs.findById(runId)
    if (!run) {
      throw new AppError('NOT_FOUND', `run ${runId} not found`)
    }
    return run
  }

  private waitForDecision(approvalId: string): Promise<DecisionEntry> {
    const existing = this.decisions.get(approvalId)
    if (existing) {
      this.decisions.delete(approvalId)
      return Promise.resolve(existing)
    }
    return new Promise<DecisionEntry>((resolve) => {
      this.waiters.set(approvalId, resolve)
    })
  }

  private resolveDecision(approvalId: string, decision: Decision, by: string): void {
    const entry: DecisionEntry = { decision, by }
    const waiter = this.waiters.get(approvalId)
    if (waiter) {
      this.waiters.delete(approvalId)
      waiter(entry)
    } else {
      this.decisions.set(approvalId, entry)
    }
  }
}

function defaultRuntimeFactory(
  island: Island,
  gate: ToolGate,
  openClawConfig?: OpenClawCliConfig,
): RuntimeAdapter {
  if (island.runtime.runtime === 'fake') {
    return new FakeRuntimeAdapter({ gate, script: parseFakeScript(island.runtime.config) })
  }
  if (island.runtime.runtime === 'openclaw') {
    const config = openClawConfig ?? {
      bin: process.env.OPENCLAW_BIN ?? 'openclaw',
      agentId: process.env.OPENCLAW_AGENT_ID ?? 'main',
      timeoutSeconds: 600,
    }
    return new OpenClawRuntimeAdapter({ cli: config })
  }
  throw new AppError(
    'INVALID_INPUT',
    `no runtime adapter for runtime kind "${island.runtime.runtime}"`,
  )
}

/** Extract `memoryCandidates` from a completed runtime result, if present. */
export function extractMemoryCandidates(result: unknown): string[] {
  if (typeof result !== 'object' || result === null) {
    return []
  }
  const candidates = (result as { memoryCandidates?: unknown }).memoryCandidates
  if (!Array.isArray(candidates)) {
    return []
  }
  return candidates.filter((candidate): candidate is string => typeof candidate === 'string')
}

// Re-export for backwards compatibility; the canonical implementation lives in
// `util/normalize-error` (shared with the OpenClaw adapter).
export { normalizeError }

/**
 * Parse the fake-runtime script from an island's runtime binding config.
 * Islands may declare a deterministic tool script; unknown/malformed config
 * falls back to no script (the adapter's default read-only analysis script).
 */
export function parseFakeScript(
  config: Record<string, unknown>,
): { toolId: string; arguments: Record<string, unknown> }[] | undefined {
  const script = config?.script
  if (!Array.isArray(script)) {
    return undefined
  }
  const steps = []
  for (const step of script) {
    if (typeof step !== 'object' || step === null) {
      continue
    }
    const toolId = (step as { toolId?: unknown }).toolId
    const args = (step as { arguments?: unknown }).arguments
    if (typeof toolId !== 'string' || typeof args !== 'object' || args === null) {
      continue
    }
    steps.push({ toolId, arguments: args as Record<string, unknown> })
  }
  return steps.length > 0 ? steps : undefined
}
