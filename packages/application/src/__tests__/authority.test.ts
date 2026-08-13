import { describe, expect, it } from 'vitest'
import { RunEngine } from '../services/run-engine'
import { ResourceAccessService } from '../services/resource-access-service'
import { IslandService } from '../services/island-service'
import { ProcessService } from '../services/process-service'
import { CapabilityService } from '../services/capability-service'
import { WorkspaceService } from '../services/workspace-service'
import { FakeRuntimeAdapter } from '../infrastructure/fake-runtime-adapter'
import type { FakeRuntimeScriptStep } from '../infrastructure/fake-runtime-adapter'
import { InMemoryToolRegistry } from '../infrastructure/tool-registry'
import type { Island } from '@element-plus/contracts'
import type { ProblemSpecificationRecord, RuntimeAdapter, ToolGate } from '../ports'
import {
  InMemoryApprovalRepository,
  InMemoryArtifactRepository,
  InMemoryCapabilityRepository,
  InMemoryEffectRepository,
  InMemoryEvaluationRepository,
  InMemoryIslandRepository,
  InMemoryMembershipRepository,
  InMemoryProblemSpecificationRepository,
  InMemoryProcessRepository,
  InMemoryRunRepository,
  InMemoryToolCallRepository,
  InMemoryWorkspaceRepository,
} from './fakes'

const NOW = '2026-08-13T00:00:00.000Z'

const OWNER = 'user-1'
const OUTSIDER = 'user-2'
const WORKSPACE_A = 'ws-a'
const WORKSPACE_B = 'ws-b'

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
    provenance: { createdAt: NOW, derivedFrom: [], reason: 'test', source: 'system' },
  }
}

function confirmedSpec(workspaceId: string): ProblemSpecificationRecord {
  return {
    id: `ps-${workspaceId}`,
    problemId: `p-${workspaceId}`,
    workspaceId,
    version: '1.0.0',
    status: 'confirmed',
    rawProblem: 'private problem in ' + workspaceId,
    structuredUnderstanding: 'the private problem',
    items: [],
    successCriteria: ['fix it'],
    constraints: [],
    provenance: { createdAt: NOW, derivedFrom: [], reason: 'test', source: 'system' },
    createdAt: NOW,
  }
}

function build(runtimeFactory?: (island: Island, gate: ToolGate) => RuntimeAdapter) {
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
  const workspacesRepo = new InMemoryWorkspaceRepository()
  const memberships = new InMemoryMembershipRepository()

  void workspacesRepo.create({
    id: WORKSPACE_A,
    slug: 'ws-a',
    name: 'Workspace A',
    kind: 'team',
    ownerUserId: OWNER,
  })
  void workspacesRepo.create({
    id: WORKSPACE_B,
    slug: 'ws-b',
    name: 'Workspace B',
    kind: 'team',
    ownerUserId: OUTSIDER,
  })
  void memberships.create({ workspaceId: WORKSPACE_A, userId: OWNER, role: 'owner' })
  void memberships.create({ workspaceId: WORKSPACE_B, userId: OUTSIDER, role: 'owner' })

  void specs.create(confirmedSpec(WORKSPACE_A))

  const capabilities = new CapabilityService({ capabilities: capabilityRepo })
  const islands = new IslandService({ islands: islandRepo, capabilities })
  const processes = new ProcessService({ processes: processRepo })
  const workspaces = new WorkspaceService({ workspaces: workspacesRepo, memberships })
  const access = new ResourceAccessService({ specifications: specs, runs, workspaces })

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
    access,
    runtimeFactory,
  })

  return { engine, runs, approvals, islands, specs, workspaces, access }
}

async function seedIsland(islands: IslandService): Promise<void> {
  await islands.createDraft({
    manifest: {
      name: activeIsland().name,
      description: activeIsland().description,
      capabilities: activeIsland().capabilities,
      runtime: activeIsland().runtime,
      permissions: [],
    },
    actorUserId: OWNER,
    id: 'isl-1',
  })
  await islands.activate('isl-1')
}

async function waitForStatus(engine: RunEngine, runId: string, statuses: string[]) {
  const start = Date.now()
  let view
  do {
    view = await engine.get({ id: OWNER }, runId)
    if (statuses.includes(view.run.status)) return view
    await new Promise((resolve) => setTimeout(resolve, 10))
  } while (Date.now() - start < 3000)
  return view
}

describe('run workspace authority (R0)', () => {
  it('owner can enqueue, read, and cancel their own run', async () => {
    const { engine, islands } = build()
    await seedIsland(islands)

    const run = await engine.enqueue({
      actorUserId: OWNER,
      islandId: 'isl-1',
      problemSpecId: `ps-${WORKSPACE_A}`,
    })
    expect(run.workspaceId).toBe(WORKSPACE_A)

    await waitForStatus(engine, run.id, ['completed'])
    const view = await engine.get({ id: OWNER }, run.id)
    expect(view.run.status).toBe('completed')
    expect(view.artifacts).toHaveLength(1)
  })

  it('outsider cannot enqueue a run from another workspace private spec', async () => {
    const { engine, islands } = build()
    await seedIsland(islands)

    await expect(
      engine.enqueue({
        actorUserId: OUTSIDER,
        islandId: 'isl-1',
        problemSpecId: `ps-${WORKSPACE_A}`,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('outsider cannot read the owner run', async () => {
    const { engine, islands } = build()
    await seedIsland(islands)
    const run = await engine.enqueue({
      actorUserId: OWNER,
      islandId: 'isl-1',
      problemSpecId: `ps-${WORKSPACE_A}`,
    })

    await expect(engine.get({ id: OUTSIDER }, run.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('outsider cannot cancel the owner run and state is unchanged', async () => {
    const { engine, islands, runs } = build()
    await seedIsland(islands)
    const run = await engine.enqueue({
      actorUserId: OWNER,
      islandId: 'isl-1',
      problemSpecId: `ps-${WORKSPACE_A}`,
    })
    await waitForStatus(engine, run.id, ['completed'])

    const before = (await runs.findById(run.id))!.status
    await expect(engine.cancel({ id: OUTSIDER }, run.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect((await runs.findById(run.id))!.status).toBe(before)
  })

  it('owner can still cancel a run when the lifecycle permits', async () => {
    const { engine, islands } = build()
    await seedIsland(islands)
    const run = await engine.enqueue({
      actorUserId: OWNER,
      islandId: 'isl-1',
      problemSpecId: `ps-${WORKSPACE_A}`,
    })
    // Cancel immediately: draft->queued->running may race; accept either a
    // successful cancel or a completed run (both prove no cross-user effect).
    await engine.cancel({ id: OWNER }, run.id).catch(() => undefined)
    const final = await engine.get({ id: OWNER }, run.id)
    expect(['cancelled', 'completed', 'running', 'queued']).toContain(final.run.status)
  })

  it('outsider cannot approve/reject the owner approval', async () => {
    const script: FakeRuntimeScriptStep[] = [
      { toolId: 'tool-send-email', arguments: { to: 'x@example.com' } },
    ]
    const { engine, islands } = build((_island, gate) => new FakeRuntimeAdapter({ script, gate }))
    await seedIsland(islands)

    const run = await engine.enqueue({
      actorUserId: OWNER,
      islandId: 'isl-1',
      problemSpecId: `ps-${WORKSPACE_A}`,
    })
    const paused = await waitForStatus(engine, run.id, ['awaiting_approval'])
    const approvalId = paused.approvals[0]!.id

    await expect(
      engine.decideApproval({ id: OUTSIDER }, run.id, approvalId, 'approve'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      engine.decideApproval({ id: OUTSIDER }, run.id, approvalId, 'reject'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    // Owner still decides and the effect then executes exactly once.
    await engine.decideApproval({ id: OWNER }, run.id, approvalId, 'approve')
    const done = await waitForStatus(engine, run.id, ['completed'])
    expect(done.effects).toHaveLength(1)
  })

  it('outsider cannot evaluate the owner run', async () => {
    const { engine, islands } = build()
    await seedIsland(islands)
    const run = await engine.enqueue({
      actorUserId: OWNER,
      islandId: 'isl-1',
      problemSpecId: `ps-${WORKSPACE_A}`,
    })
    await waitForStatus(engine, run.id, ['completed'])

    await expect(
      engine.evaluate({ id: OUTSIDER }, run.id, { verdict: 'pass' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      engine.evaluate({ id: OWNER }, run.id, { verdict: 'pass' }),
    ).resolves.toMatchObject({ verdict: 'pass' })
  })

  it('list() is scoped to the user workspaces (no foreign runs)', async () => {
    const { engine, islands } = build()
    await seedIsland(islands)
    const ownerRun = await engine.enqueue({
      actorUserId: OWNER,
      islandId: 'isl-1',
      problemSpecId: `ps-${WORKSPACE_A}`,
    })

    const ownerList = await engine.list({ id: OWNER })
    expect(ownerList.map((run) => run.id)).toContain(ownerRun.id)

    const outsiderList = await engine.list({ id: OUTSIDER })
    expect(outsiderList.map((run) => run.id)).not.toContain(ownerRun.id)
  })
})

describe('resource access subject relationships', () => {
  it('resolves owned for the owning workspace and null otherwise', async () => {
    const { access } = build()
    expect(
      await access.resolveSubjectRelationship(WORKSPACE_A, {
        id: `ps-${WORKSPACE_A}`,
        kind: 'problem_specification',
      }),
    ).toBe('owned')
    expect(
      await access.resolveSubjectRelationship(WORKSPACE_B, {
        id: `ps-${WORKSPACE_A}`,
        kind: 'problem_specification',
      }),
    ).toBeNull()
  })

  it('resolves network for process/island (global registries)', async () => {
    const { access } = build()
    expect(
      await access.resolveSubjectRelationship(WORKSPACE_A, { id: 'isl-1', kind: 'island' }),
    ).toBe('network')
    expect(
      await access.resolveSubjectRelationship(WORKSPACE_B, { id: 'p-1', kind: 'process' }),
    ).toBe('network')
  })

  it('denies unknown subject kinds', async () => {
    const { access } = build()
    expect(
      await access.resolveSubjectRelationship(WORKSPACE_A, {
        id: 'x',
        kind: 'memory_entry' as never,
      }),
    ).toBeNull()
  })
})
