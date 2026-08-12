import { describe, expect, it } from 'vitest'
import type { Island } from '@element-plus/contracts'
import type { ProblemSpecificationRecord } from '../ports'
import { RunEngine, normalizeError } from '../services/run-engine'
import { IslandService } from '../services/island-service'
import { ProcessService } from '../services/process-service'
import { CapabilityService } from '../services/capability-service'
import { FakeRuntimeAdapter } from '../infrastructure/fake-runtime-adapter'
import type { FakeRuntimeScriptStep } from '../infrastructure/fake-runtime-adapter'
import { InMemoryToolRegistry } from '../infrastructure/tool-registry'
import type { RuntimeAdapter, ToolGate } from '../ports'
import {
  InMemoryApprovalRepository,
  InMemoryArtifactRepository,
  InMemoryCapabilityRepository,
  InMemoryEffectRepository,
  InMemoryEvaluationRepository,
  InMemoryIslandRepository,
  InMemoryProblemSpecificationRepository,
  InMemoryProcessRepository,
  InMemoryRunRepository,
  InMemoryToolCallRepository,
} from './fakes'

const NOW = '2026-08-13T00:00:00.000Z'

function activeIsland(): Island {
  return {
    id: 'isl-1',
    version: '1.0.0',
    status: 'active',
    name: 'Structured Analysis Island',
    description: 'structured analysis',
    capabilities: [{ id: 'cap-1', kind: 'capability' }],
    runtime: { runtime: 'fake', config: {} },
    permissions: [],
    provenance: {
      createdAt: NOW,
      derivedFrom: [],
      reason: 'test',
      source: 'system',
    },
  }
}

function confirmedSpec(): ProblemSpecificationRecord {
  return {
    id: 'ps-1',
    problemId: 'p-1',
    workspaceId: 'ws-1',
    version: '1.0.0',
    status: 'confirmed',
    rawProblem: 'checkout fails',
    structuredUnderstanding: 'the checkout flow fails at payment',
    items: [],
    successCriteria: ['fix it'],
    constraints: [],
    provenance: {
      createdAt: NOW,
      derivedFrom: [],
      reason: 'test',
      source: 'system',
    },
    createdAt: NOW,
  }
}

interface Harness {
  engine: RunEngine
  runs: InMemoryRunRepository
  approvals: InMemoryApprovalRepository
  toolCalls: InMemoryToolCallRepository
  effects: InMemoryEffectRepository
  artifacts: InMemoryArtifactRepository
  evaluations: InMemoryEvaluationRepository
  specs: InMemoryProblemSpecificationRepository
  islands: IslandService
}

function build(runtimeFactory?: (island: Island, gate: ToolGate) => RuntimeAdapter): Harness {
  const runs = new InMemoryRunRepository()
  const approvals = new InMemoryApprovalRepository()
  const toolCalls = new InMemoryToolCallRepository()
  const effects = new InMemoryEffectRepository()
  const artifacts = new InMemoryArtifactRepository()
  const evaluations = new InMemoryEvaluationRepository()
  const specs = new InMemoryProblemSpecificationRepository()
  const islandRepo = new InMemoryIslandRepository()
  const processRepo = new InMemoryProcessRepository()
  const capabilityRepo = new InMemoryCapabilityRepository()

  const capabilities = new CapabilityService({ capabilities: capabilityRepo })
  const islands = new IslandService({ islands: islandRepo, capabilities })
  const processes = new ProcessService({ processes: processRepo })

  const engine = new RunEngine({
    runs,
    approvals,
    toolCalls,
    effects,
    artifacts,
    evaluations,
    specifications: specs,
    registry: new InMemoryToolRegistry(),
    islands,
    processes,
    runtimeFactory,
  })

  return { engine, runs, approvals, toolCalls, effects, artifacts, evaluations, specs, islands }
}

async function waitForStatus(
  engine: RunEngine,
  runId: string,
  statuses: string[],
  timeoutMs = 3000,
) {
  const start = Date.now()
  let view
  do {
    view = await engine.get(runId)
    if (statuses.includes(view.run.status)) return view
    await new Promise((resolve) => setTimeout(resolve, 10))
  } while (Date.now() - start < timeoutMs)
  return view
}

describe('run engine', () => {
  it('executes the Structured Analysis island end-to-end on the fake runtime', async () => {
    const h = build()
    await h.islands.createDraft({
      manifest: {
        name: activeIsland().name,
        description: activeIsland().description,
        capabilities: activeIsland().capabilities,
        runtime: activeIsland().runtime,
        permissions: [],
      },
      actorUserId: 'user-1',
      id: 'isl-1',
    })
    await h.islands.activate('isl-1')
    await h.specs.create(confirmedSpec())

    const run = await h.engine.enqueue({
      actorUserId: 'user-1',
      islandId: 'isl-1',
      problemSpecId: 'ps-1',
    })

    const view = await waitForStatus(h.engine, run.id, ['completed'])
    expect(view.run.status).toBe('completed')

    const types = view.events.map((event) => event.type)
    expect(types).toContain('enqueue')
    expect(types).toContain('start')
    expect(types).toContain('complete')

    expect(view.artifacts).toHaveLength(1)
    expect(view.artifacts[0]!.kind).toBe('result')
    expect(view.toolCalls).toHaveLength(1)
    expect(view.toolCalls[0]!.toolName).toBe('Analyze')
    expect(view.toolCalls[0]!.status).toBe('executed')
    expect(view.approvals).toHaveLength(0)
    expect(view.effects).toHaveLength(0)
  })

  it('pauses for an irreversible effect; rejection means the tool never executes', async () => {
    const script: FakeRuntimeScriptStep[] = [
      { toolId: 'tool-send-email', arguments: { to: 'user@example.com' } },
    ]
    const h = build((_island, gate) => new FakeRuntimeAdapter({ script, gate }))
    await h.islands.createDraft({
      manifest: {
        name: activeIsland().name,
        description: activeIsland().description,
        capabilities: activeIsland().capabilities,
        runtime: activeIsland().runtime,
        permissions: [],
      },
      actorUserId: 'user-1',
      id: 'isl-1',
    })
    await h.islands.activate('isl-1')
    await h.specs.create(confirmedSpec())

    const run = await h.engine.enqueue({
      actorUserId: 'user-1',
      islandId: 'isl-1',
      problemSpecId: 'ps-1',
    })

    const paused = await waitForStatus(h.engine, run.id, ['awaiting_approval'])
    expect(paused.run.status).toBe('awaiting_approval')
    expect(paused.approvals).toHaveLength(1)
    expect(paused.approvals[0]!.status).toBe('pending')
    expect(paused.toolCalls[0]!.status).toBe('requested')

    await h.engine.decideApproval({ id: 'user-1' }, run.id, paused.approvals[0]!.id, 'reject')

    const view = await waitForStatus(h.engine, run.id, ['completed'])
    expect(view.run.status).toBe('completed')

    // Tool never executed; no effect record; the decision is on the timeline.
    expect(view.toolCalls[0]!.status).toBe('rejected')
    expect(view.effects).toHaveLength(0)
    const types = view.events.map((event) => event.type)
    expect(types).toContain('request_approval')
    expect(types).toContain('reject')
    expect(view.approvals[0]!.status).toBe('rejected')
  })

  it('approving an irreversible effect executes the tool and records the effect', async () => {
    const script: FakeRuntimeScriptStep[] = [
      { toolId: 'tool-send-email', arguments: { to: 'user@example.com' } },
    ]
    const h = build((_island, gate) => new FakeRuntimeAdapter({ script, gate }))
    await h.islands.createDraft({
      manifest: {
        name: activeIsland().name,
        description: activeIsland().description,
        capabilities: activeIsland().capabilities,
        runtime: activeIsland().runtime,
        permissions: [],
      },
      actorUserId: 'user-1',
      id: 'isl-1',
    })
    await h.islands.activate('isl-1')
    await h.specs.create(confirmedSpec())

    const run = await h.engine.enqueue({
      actorUserId: 'user-1',
      islandId: 'isl-1',
      problemSpecId: 'ps-1',
    })

    const paused = await waitForStatus(h.engine, run.id, ['awaiting_approval'])
    await h.engine.decideApproval({ id: 'user-1' }, run.id, paused.approvals[0]!.id, 'approve')

    const view = await waitForStatus(h.engine, run.id, ['completed'])
    expect(view.toolCalls[0]!.status).toBe('executed')
    expect(view.effects).toHaveLength(1)
    expect(view.effects[0]!.kind).toBe('external_irreversible')
    expect(view.approvals[0]!.status).toBe('approved')
    expect(view.events.map((event) => event.type)).toContain('approve')
  })

  it('cancelling a run awaiting approval never executes the tool', async () => {
    const script: FakeRuntimeScriptStep[] = [
      { toolId: 'tool-send-email', arguments: { to: 'user@example.com' } },
    ]
    const h = build((_island, gate) => new FakeRuntimeAdapter({ script, gate }))
    await h.islands.createDraft({
      manifest: {
        name: activeIsland().name,
        description: activeIsland().description,
        capabilities: activeIsland().capabilities,
        runtime: activeIsland().runtime,
        permissions: [],
      },
      actorUserId: 'user-1',
      id: 'isl-1',
    })
    await h.islands.activate('isl-1')
    await h.specs.create(confirmedSpec())

    const run = await h.engine.enqueue({
      actorUserId: 'user-1',
      islandId: 'isl-1',
      problemSpecId: 'ps-1',
    })

    await waitForStatus(h.engine, run.id, ['awaiting_approval'])
    await h.engine.cancel({ id: 'user-1' }, run.id)

    const view = await waitForStatus(h.engine, run.id, ['cancelled'])
    expect(view.run.status).toBe('cancelled')
    expect(view.toolCalls[0]!.status).toBe('denied')
    expect(view.effects).toHaveLength(0)
    expect(view.artifacts).toHaveLength(0)
  })

  it('denies an unknown tool by default', async () => {
    const script: FakeRuntimeScriptStep[] = [{ toolId: 'tool-nonexistent', arguments: {} }]
    const h = build((_island, gate) => new FakeRuntimeAdapter({ script, gate }))
    await h.islands.createDraft({
      manifest: {
        name: activeIsland().name,
        description: activeIsland().description,
        capabilities: activeIsland().capabilities,
        runtime: activeIsland().runtime,
        permissions: [],
      },
      actorUserId: 'user-1',
      id: 'isl-1',
    })
    await h.islands.activate('isl-1')
    await h.specs.create(confirmedSpec())

    const run = await h.engine.enqueue({
      actorUserId: 'user-1',
      islandId: 'isl-1',
      problemSpecId: 'ps-1',
    })

    const view = await waitForStatus(h.engine, run.id, ['completed'])
    expect(view.toolCalls[0]!.status).toBe('denied')
    expect(view.effects).toHaveLength(0)
  })

  it('evaluates only a completed run', async () => {
    const h = build()
    await h.islands.createDraft({
      manifest: {
        name: activeIsland().name,
        description: activeIsland().description,
        capabilities: activeIsland().capabilities,
        runtime: activeIsland().runtime,
        permissions: [],
      },
      actorUserId: 'user-1',
      id: 'isl-1',
    })
    await h.islands.activate('isl-1')
    await h.specs.create(confirmedSpec())

    const run = await h.engine.enqueue({
      actorUserId: 'user-1',
      islandId: 'isl-1',
      problemSpecId: 'ps-1',
    })
    await waitForStatus(h.engine, run.id, ['completed'])

    const evaluation = await h.engine.evaluate({ id: 'user-1' }, run.id, {
      verdict: 'pass',
      score: 0.9,
      criteria: [{ name: 'correct', met: true }],
    })
    expect(evaluation.verdict).toBe('pass')

    // A fresh run is queued; evaluating it must fail.
    const second = await h.engine.enqueue({
      actorUserId: 'user-1',
      islandId: 'isl-1',
      problemSpecId: 'ps-1',
    })
    await expect(
      h.engine.evaluate({ id: 'user-1' }, second.id, { verdict: 'pass' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rejects enqueue for a non-active island or non-confirmed spec', async () => {
    const h = build()
    await h.specs.create(confirmedSpec())
    await expect(
      h.engine.enqueue({ actorUserId: 'user-1', islandId: 'missing', problemSpecId: 'ps-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('error normalization', () => {
  it('passes through a RuntimeError shape', () => {
    expect(normalizeError({ code: 'RUNTIME_ERROR', message: 'boom' })).toEqual({
      code: 'RUNTIME_ERROR',
      message: 'boom',
    })
  })

  it('normalizes a generic Error', () => {
    expect(normalizeError(new Error('boom'))).toEqual({ code: 'ENGINE_ERROR', message: 'boom' })
  })

  it('normalizes unknown values', () => {
    expect(normalizeError('boom')).toEqual({ code: 'UNKNOWN', message: 'boom' })
  })
})
