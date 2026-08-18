import { describe, expect, it } from 'vitest'
import { CapabilityService } from '../services/capability-service'
import { IslandService } from '../services/island-service'
import { ProcessService } from '../services/process-service'
import { structuredAnalysisIslandManifest } from '../reference-islands/structured-analysis'
import { controlledActionIslandManifest } from '../reference-islands/controlled-action'
import type { IslandManifest, ProcessStep } from '@element-plus/contracts'
import {
  InMemoryCapabilityRepository,
  InMemoryIslandRepository,
  InMemoryProcessRepository,
} from './fakes'

const ACTOR = 'user-1'

function manifest(overrides: Partial<IslandManifest> = {}): IslandManifest {
  return {
    name: 'Test Island',
    description: 'a test island',
    capabilities: [{ id: 'cap-1', kind: 'capability' }],
    runtime: { runtime: 'fake', config: {} },
    permissions: [],
    ...overrides,
  }
}

function build() {
  const capabilityRepo = new InMemoryCapabilityRepository()
  const processRepo = new InMemoryProcessRepository()
  const islandRepo = new InMemoryIslandRepository()
  const capabilities = new CapabilityService({ capabilities: capabilityRepo })
  const processes = new ProcessService({ processes: processRepo })
  const islands = new IslandService({ islands: islandRepo, capabilities })
  return { capabilities, processes, islands, islandRepo, processRepo }
}

const STEPS: ProcessStep[] = [
  { id: 's1', order: 0, title: 'gather', instruction: 'collect', dependsOn: [], status: 'pending' },
  {
    id: 's2',
    order: 1,
    title: 'analyze',
    instruction: 'analyze',
    dependsOn: ['s1'],
    status: 'pending',
  },
]

describe('capability registry', () => {
  it('registers a capability', async () => {
    const { capabilities } = build()
    const capability = await capabilities.register({
      name: 'Web Search',
      description: 'search the web',
      actorUserId: ACTOR,
    })
    expect(capability.version).toBe('1.0.0')
    expect(capability.provenance.actor?.id).toBe(ACTOR)
  })

  it('rejects a duplicate capability name', async () => {
    const { capabilities } = build()
    await capabilities.register({ name: 'Web Search', description: 'x', actorUserId: ACTOR })
    await expect(
      capabilities.register({ name: 'Web Search', description: 'y', actorUserId: ACTOR }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('ensureByName is idempotent', async () => {
    const { capabilities } = build()
    const first = await capabilities.ensureByName({
      name: 'Structured Analysis',
      description: 'x',
      actorUserId: ACTOR,
    })
    const second = await capabilities.ensureByName({
      name: 'Structured Analysis',
      description: 'x',
      actorUserId: ACTOR,
    })
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(first.capability.id).toBe(second.capability.id)
  })
})

describe('process registry', () => {
  it('creates a draft and validates structure', async () => {
    const { processes } = build()
    const process = await processes.createDraft({
      title: 'Analyze',
      description: 'analysis process',
      steps: STEPS,
      actorUserId: ACTOR,
    })
    expect(process.status).toBe('draft')
    expect(process.version).toBe('1.0.0')
  })

  it('rejects an invalid process (duplicate step id)', async () => {
    const { processes } = build()
    await expect(
      processes.createDraft({
        title: 'Bad',
        description: 'bad',
        steps: [
          { id: 's1', order: 0, title: 'a', instruction: 'a', dependsOn: [], status: 'pending' },
          { id: 's1', order: 1, title: 'b', instruction: 'b', dependsOn: [], status: 'pending' },
        ],
        actorUserId: ACTOR,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('advances draft -> validated -> published', async () => {
    const { processes } = build()
    const created = await processes.createDraft({
      title: 'Analyze',
      description: 'analysis process',
      steps: STEPS,
      actorUserId: ACTOR,
    })
    expect((await processes.validate(created.id)).status).toBe('validated')
    expect((await processes.publish(created.id)).status).toBe('published')
  })

  it('newVersion preserves the prior version and bumps the patch', async () => {
    const { processes, processRepo } = build()
    const created = await processes.createDraft({
      title: 'Analyze',
      description: 'analysis process',
      steps: STEPS,
      actorUserId: ACTOR,
    })
    const next = await processes.newVersion(
      created.id,
      { description: 'revised analysis process' },
      ACTOR,
    )

    expect(next.version).toBe('1.0.1')
    expect(next.status).toBe('draft')
    expect(next.description).toBe('revised analysis process')

    const all = processRepo.all().filter((process) => process.id === created.id)
    expect(all.map((process) => process.version).sort()).toEqual(['1.0.0', '1.0.1'])
    expect(all.find((process) => process.version === '1.0.0')!.description).toBe('analysis process')
  })
})

describe('island registry', () => {
  it('creates a draft, proposes, activates, and retires', async () => {
    const { islands } = build()
    const draft = await islands.createDraft({ manifest: manifest(), actorUserId: ACTOR })
    expect(draft.status).toBe('draft')

    const candidate = await islands.propose(draft.id)
    expect(candidate.status).toBe('candidate')

    const active = await islands.activate(draft.id)
    expect(active.status).toBe('active')

    const retired = await islands.retire(draft.id)
    expect(retired.status).toBe('retired')
  })

  it('an invalid island (unbound runtime) cannot activate', async () => {
    const { islands } = build()
    const draft = await islands.createDraft({
      manifest: manifest({ runtime: { runtime: 'none', config: {} } }),
      actorUserId: ACTOR,
    })
    await expect(islands.activate(draft.id)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('an active island cannot be re-activated (no silent transition)', async () => {
    const { islands } = build()
    const draft = await islands.createDraft({ manifest: manifest(), actorUserId: ACTOR })
    await islands.activate(draft.id)
    await expect(islands.activate(draft.id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('reuse before creation: resolves a compatible active island', async () => {
    const { islands } = build()
    const draft = await islands.createDraft({
      manifest: manifest({ capabilities: [{ id: 'cap-1', kind: 'capability' }] }),
      actorUserId: ACTOR,
    })
    await islands.activate(draft.id)

    const resolved = await islands.resolve(['cap-1'])
    expect(resolved).not.toBeNull()
    expect(resolved!.island.id).toBe(draft.id)
  })

  it('reuse before creation: resolveOrCreate returns the existing island', async () => {
    const { islands, islandRepo } = build()
    const draft = await islands.createDraft({
      manifest: manifest({ capabilities: [{ id: 'cap-1', kind: 'capability' }] }),
      actorUserId: ACTOR,
    })
    await islands.activate(draft.id)

    const result = await islands.resolveOrCreate({
      manifest: manifest({ name: 'Should Be Reused' }),
      requiredCapabilityIds: ['cap-1'],
      actorUserId: ACTOR,
    })

    expect(result.reused).toBe(true)
    expect(result.island.id).toBe(draft.id)
    expect(islandRepo.all()).toHaveLength(1)
  })

  it('reuse before creation: no match creates a draft island', async () => {
    const { islands, islandRepo } = build()
    const result = await islands.resolveOrCreate({
      manifest: manifest({ capabilities: [{ id: 'cap-1', kind: 'capability' }] }),
      requiredCapabilityIds: ['cap-1'],
      actorUserId: ACTOR,
    })

    expect(result.reused).toBe(false)
    expect(result.island.status).toBe('draft')
    expect(islandRepo.all()).toHaveLength(1)
  })

  it('newVersion preserves the prior island version', async () => {
    const { islands, islandRepo } = build()
    const draft = await islands.createDraft({ manifest: manifest(), actorUserId: ACTOR })
    const next = await islands.newVersion(draft.id, { description: 'revised island' }, ACTOR)

    expect(next.version).toBe('1.0.1')
    const all = islandRepo.all().filter((island) => island.id === draft.id)
    expect(all.map((island) => island.version).sort()).toEqual(['1.0.0', '1.0.1'])
    expect(all.find((island) => island.version === '1.0.0')!.status).toBe('draft')
  })

  it('carries provenance derivedFrom back to a ProblemSpecification', async () => {
    const { islands } = build()
    const draft = await islands.createDraft({
      manifest: manifest(),
      actorUserId: ACTOR,
      derivedFrom: [{ id: 'ps-1', kind: 'problem_specification' }],
    })
    expect(draft.provenance.derivedFrom).toEqual([{ id: 'ps-1', kind: 'problem_specification' }])
  })
})

describe('reference structured analysis island', () => {
  it('ensureReferenceIsland creates, activates, and then reuses', async () => {
    const { islands, capabilities } = build()

    const first = await islands.ensureReferenceIsland({ actorUserId: ACTOR })
    expect(first.reused).toBe(false)
    expect(first.island.status).toBe('active')
    expect(first.island.name).toBe(structuredAnalysisIslandManifest.name)

    const second = await islands.ensureReferenceIsland({ actorUserId: ACTOR })
    expect(second.reused).toBe(true)
    expect(second.island.id).toBe(first.island.id)

    const capability = await capabilities.findByName('Structured Analysis')
    expect(capability).not.toBeNull()
  })
})

describe('reference controlled action island', () => {
  it('ensureControlledActionIsland creates, activates, and then reuses', async () => {
    const { islands, capabilities } = build()

    const first = await islands.ensureControlledActionIsland({ actorUserId: ACTOR })
    expect(first.reused).toBe(false)
    expect(first.island.status).toBe('active')
    expect(first.island.name).toBe('Controlled Action Island')

    const second = await islands.ensureControlledActionIsland({ actorUserId: ACTOR })
    expect(second.reused).toBe(true)
    expect(second.island.id).toBe(first.island.id)

    const capability = await capabilities.findByName('Controlled Action')
    expect(capability).not.toBeNull()
  })

  it('the manifest declares an external_reversible script step', () => {
    expect(controlledActionIslandManifest.runtime.runtime).toBe('fake')
    expect(controlledActionIslandManifest.capabilities[0]!.id).toBe('cap-controlled-action')
  })
})
