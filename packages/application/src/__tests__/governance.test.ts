import { describe, expect, it } from 'vitest'
import { CapabilityService } from '../services/capability-service'
import { IslandService } from '../services/island-service'
import { KnowledgeService } from '../services/knowledge-service'
import { ProcessService } from '../services/process-service'
import { VersionProposalService } from '../services/version-proposal-service'
import {
  InMemoryCapabilityRepository,
  InMemoryIslandRepository,
  InMemoryKnowledgeRepository,
  InMemoryProcessRepository,
  InMemoryVersionProposalRepository,
} from './fakes'

const ACTOR = 'user-1'

function build() {
  const knowledgeRepo = new InMemoryKnowledgeRepository()
  const proposalRepo = new InMemoryVersionProposalRepository()
  const processRepo = new InMemoryProcessRepository()
  const islandRepo = new InMemoryIslandRepository()
  const capabilityRepo = new InMemoryCapabilityRepository()

  const knowledge = new KnowledgeService({ knowledge: knowledgeRepo })
  const capabilities = new CapabilityService({ capabilities: capabilityRepo })
  const processes = new ProcessService({ processes: processRepo })
  const islands = new IslandService({ islands: islandRepo, capabilities })
  const proposals = new VersionProposalService({
    proposals: proposalRepo,
    knowledge,
    processes,
    islands,
  })

  return {
    knowledge,
    proposals,
    knowledgeRepo,
    proposalRepo,
    processes,
    islands,
    islandRepo,
    processRepo,
  }
}

describe('knowledge governance', () => {
  it('creates, publishes, and versions knowledge preserving the prior version', async () => {
    const { knowledge, knowledgeRepo } = build()
    const draft = await knowledge.createDraft({
      workspaceId: 'ws-1',
      ownerId: 'user-1',
      title: 'Retry guidance',
      content: 'always retry with backoff',
      evidenceRefs: [{ id: 'ev-1', kind: 'evidence' }],
      actorUserId: ACTOR,
    })
    expect(draft.status).toBe('draft')
    expect(draft.evidenceRefs).toHaveLength(1)

    expect((await knowledge.publish(draft.id)).status).toBe('published')

    const next = await knowledge.newVersion(
      draft.id,
      { content: 'always retry with exponential backoff' },
      ACTOR,
    )
    expect(next.version).toBe('1.0.1')
    expect(next.status).toBe('draft')

    const versions = knowledgeRepo.all().filter((entry) => entry.id === draft.id)
    expect(versions.map((entry) => entry.version).sort()).toEqual(['1.0.0', '1.0.1'])
    expect(versions.find((entry) => entry.version === '1.0.0')!.status).toBe('superseded')
  })

  it('rejects publishing an empty draft', async () => {
    const { knowledge } = build()
    await expect(
      knowledge.createDraft({
        workspaceId: 'ws-1',
        ownerId: 'user-1',
        title: '  ',
        content: '',
        actorUserId: ACTOR,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
})

describe('version proposal governance', () => {
  it('moves through the review lifecycle and merges to a new knowledge version', async () => {
    const { knowledge, proposals, knowledgeRepo } = build()
    const draft = await knowledge.createDraft({
      workspaceId: 'ws-1',
      ownerId: 'user-1',
      title: 'Retry guidance',
      content: 'always retry with backoff',
      evidenceRefs: [{ id: 'ev-1', kind: 'evidence' }],
      actorUserId: ACTOR,
    })
    await knowledge.publish(draft.id)

    const proposal = await proposals.propose({
      target: { id: draft.id, kind: 'knowledge' },
      fromVersion: '1.0.0',
      toVersion: '1.0.1',
      rationale: 'new evidence shows exponential backoff is better',
      content: 'always retry with exponential backoff',
      evidenceRefs: [{ id: 'ev-2', kind: 'evidence' }],
      actorUserId: ACTOR,
    })
    expect(proposal.status).toBe('proposed')

    await proposals.review(proposal.id)
    await proposals.approve(proposal.id)
    expect((await proposals.get(proposal.id)).status).toBe('approved')

    const merged = await proposals.merge(proposal.id, ACTOR)
    expect(merged.status).toBe('merged')

    const versions = knowledgeRepo.all().filter((entry) => entry.id === draft.id)
    const newest = versions.find((entry) => entry.version === '1.0.1')!
    expect(newest.content).toBe('always retry with exponential backoff')
    expect(newest.status).toBe('published')
    expect(versions.find((entry) => entry.version === '1.0.0')!.status).toBe('superseded')
    expect(newest.provenance.derivedFrom).toContainEqual({ id: draft.id, kind: 'knowledge' })
  })

  it('rejects a non-forward proposal', async () => {
    const { proposals } = build()
    await expect(
      proposals.propose({
        target: { id: 'k-1', kind: 'knowledge' },
        fromVersion: '1.0.0',
        toVersion: '1.0.0',
        rationale: 'not forward',
        actorUserId: ACTOR,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('cannot merge before approval', async () => {
    const { knowledge, proposals } = build()
    const draft = await knowledge.createDraft({
      workspaceId: 'ws-1',
      ownerId: 'user-1',
      title: 'T',
      content: 'content',
      actorUserId: ACTOR,
    })
    const proposal = await proposals.propose({
      target: { id: draft.id, kind: 'knowledge' },
      fromVersion: '1.0.0',
      toVersion: '1.0.1',
      rationale: 'reason',
      content: 'new content',
      actorUserId: ACTOR,
    })
    await expect(proposals.merge(proposal.id, ACTOR)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rejected proposals are terminal', async () => {
    const { proposals } = build()
    const proposal = await proposals.propose({
      target: { id: 'k-1', kind: 'knowledge' },
      fromVersion: '1.0.0',
      toVersion: '1.0.1',
      rationale: 'reason',
      content: 'new content',
      actorUserId: ACTOR,
    })
    await proposals.reject(proposal.id)
    await expect(proposals.approve(proposal.id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('supports a process version proposal (one patch forward)', async () => {
    const { proposals, processes, processRepo } = build()
    const process = await processes.createDraft({
      title: 'Analyze',
      description: 'analysis',
      steps: [
        {
          id: 's1',
          order: 0,
          title: 'gather',
          instruction: 'collect',
          dependsOn: [],
          status: 'pending',
        },
      ],
      actorUserId: ACTOR,
    })
    const proposal = await proposals.propose({
      target: { id: process.id, kind: 'process' },
      fromVersion: '1.0.0',
      toVersion: '1.0.1',
      rationale: 'evolve the process',
      actorUserId: ACTOR,
    })
    await proposals.review(proposal.id)
    await proposals.approve(proposal.id)
    await proposals.merge(proposal.id, ACTOR)

    const versions = processRepo.all().filter((entry) => entry.id === process.id)
    expect(versions.map((entry) => entry.version).sort()).toEqual(['1.0.0', '1.0.1'])
  })

  it('supports an island version proposal (one patch forward)', async () => {
    const { proposals, islands, islandRepo } = build()
    const island = await islands.createDraft({
      manifest: {
        name: 'Test Island',
        description: 'test',
        capabilities: [{ id: 'cap-1', kind: 'capability' }],
        runtime: { runtime: 'fake', config: {} },
        permissions: [],
      },
      actorUserId: ACTOR,
    })
    const proposal = await proposals.propose({
      target: { id: island.id, kind: 'island' },
      fromVersion: '1.0.0',
      toVersion: '1.0.1',
      rationale: 'evolve the island',
      actorUserId: ACTOR,
    })
    await proposals.review(proposal.id)
    await proposals.approve(proposal.id)
    await proposals.merge(proposal.id, ACTOR)

    const versions = islandRepo.all().filter((entry) => entry.id === island.id)
    expect(versions.map((entry) => entry.version).sort()).toEqual(['1.0.0', '1.0.1'])
  })

  it('rejects a process proposal that skips a patch', async () => {
    const { proposals, processes } = build()
    const process = await processes.createDraft({
      title: 'Analyze',
      description: 'analysis',
      steps: [
        {
          id: 's1',
          order: 0,
          title: 'gather',
          instruction: 'collect',
          dependsOn: [],
          status: 'pending',
        },
      ],
      actorUserId: ACTOR,
    })
    const proposal = await proposals.propose({
      target: { id: process.id, kind: 'process' },
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      rationale: 'skip a patch',
      actorUserId: ACTOR,
    })
    await proposals.review(proposal.id)
    await proposals.approve(proposal.id)
    await expect(proposals.merge(proposal.id, ACTOR)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })
})
