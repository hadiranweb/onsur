import { describe, expect, it } from 'vitest'
import { AuthService } from '../services/auth-service'
import { EvidenceService } from '../services/evidence-service'
import { FeedbackService } from '../services/feedback-service'
import { MemoryService } from '../services/memory-service'
import { WorkspaceService } from '../services/workspace-service'
import type { RunRecord } from '../ports'
import {
  FakePasswordHasher,
  FakeSessionCodec,
  InMemoryEvidenceRepository,
  InMemoryFeedbackRepository,
  InMemoryMembershipRepository,
  InMemoryMemoryRepository,
  InMemoryProblemSpecificationRepository,
  InMemoryRunRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
} from './fakes'

const NOW = '2026-08-13T00:00:00.000Z'

function build() {
  const users = new InMemoryUserRepository()
  const sessions = new InMemorySessionRepository()
  const workspacesRepo = new InMemoryWorkspaceRepository()
  const memberships = new InMemoryMembershipRepository()
  const workspaces = new WorkspaceService({ workspaces: workspacesRepo, memberships })
  const auth = new AuthService({
    users,
    sessions,
    hasher: new FakePasswordHasher(),
    codec: new FakeSessionCodec(),
    workspaces,
  })

  const runs = new InMemoryRunRepository()
  const specs = new InMemoryProblemSpecificationRepository()
  const evidenceRepo = new InMemoryEvidenceRepository()
  const feedbackRepo = new InMemoryFeedbackRepository()
  const memoryRepo = new InMemoryMemoryRepository()

  const memory = new MemoryService({ memory: memoryRepo, workspaces, runs, specifications: specs })
  const feedback = new FeedbackService({
    feedback: feedbackRepo,
    runs,
    specifications: specs,
    workspaces,
    memory,
  })
  const evidence = new EvidenceService({ evidence: evidenceRepo })

  return {
    auth,
    workspaces,
    runs,
    specs,
    evidence,
    feedback,
    memory,
    evidenceRepo,
    feedbackRepo,
    memoryRepo,
  }
}

async function register(auth: AuthService, email: string) {
  const result = await auth.register({
    email,
    password: 'password123',
    displayName: email.split('@')[0] ?? 'u',
  })
  return result.user
}

function seedRun(
  runs: InMemoryRunRepository,
  specs: InMemoryProblemSpecificationRepository,
  input: {
    runId: string
    workspaceId: string
    ownerId: string
  },
) {
  specs.create({
    id: 'spec-' + input.runId,
    problemId: 'problem-' + input.runId,
    workspaceId: input.workspaceId,
    version: '1.0.0',
    status: 'confirmed',
    rawProblem: 'a real problem',
    structuredUnderstanding: 'a real problem, structured',
    items: [],
    successCriteria: ['solve it'],
    constraints: [],
    provenance: { createdAt: NOW, derivedFrom: [], reason: 'test', source: 'system' },
  })
  const run: RunRecord = {
    id: input.runId,
    workspaceId: input.workspaceId,
    status: 'completed',
    snapshot: {
      problemSpec: { id: 'spec-' + input.runId, kind: 'problem_specification' },
      island: { id: 'isl-1', kind: 'island' },
      createdAt: NOW,
    },
    provenance: {
      actor: { id: input.ownerId, kind: 'user' },
      createdAt: NOW,
      derivedFrom: [],
      reason: 'test run',
      source: 'system',
    },
    createdAt: NOW,
    updatedAt: NOW,
  }
  void runs.create(run)
}

describe('evidence service', () => {
  it('intake computes a fingerprint and starts at intake', async () => {
    const { evidence } = build()
    const record = await evidence.intake({
      workspaceId: 'ws-1',
      kind: 'evidence',
      content: 'the deployment failed on the database migration step',
      actorUserId: 'user-1',
    })
    expect(record.status).toBe('intake')
    expect(record.fingerprint).toMatch(/^sha256:/)
  })

  it('rejects evidence that fails the quality gate on submit', async () => {
    const { evidence } = build()
    const record = await evidence.intake({
      workspaceId: 'ws-1',
      kind: 'evidence',
      content: 'tiny',
      actorUserId: 'user-1',
    })
    await expect(evidence.submit(record.id)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('advances intake -> pending_review -> accepted', async () => {
    const { evidence } = build()
    const record = await evidence.intake({
      workspaceId: 'ws-1',
      kind: 'evidence',
      content: 'the deployment failed on the database migration step',
      actorUserId: 'user-1',
    })
    expect((await evidence.submit(record.id)).status).toBe('pending_review')
    expect((await evidence.accept(record.id)).status).toBe('accepted')
  })

  it('rejected evidence can never promote', async () => {
    const { evidence } = build()
    const record = await evidence.intake({
      workspaceId: 'ws-1',
      kind: 'evidence',
      content: 'the deployment failed on the database migration step',
      actorUserId: 'user-1',
    })
    await evidence.submit(record.id)
    await evidence.reject(record.id)
    await expect(evidence.accept(record.id)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('detects exact and approximate duplicates within a workspace', async () => {
    const { evidence } = build()
    await evidence.intake({
      workspaceId: 'ws-1',
      kind: 'evidence',
      content: 'the checkout flow fails at the payment step when a card is declined',
      actorUserId: 'user-1',
    })

    // Exact duplicate: identical content → identical fingerprint.
    const exact = await evidence.findDuplicates(
      'ws-1',
      'the checkout flow fails at the payment step when a card is declined',
    )
    expect(exact.exact).toHaveLength(1)

    // Approximate duplicate: same meaning, slightly different wording.
    const approximate = await evidence.findDuplicates(
      'ws-1',
      'checkout flow fails at the payment step when a card is declined',
    )
    expect(approximate.exact).toHaveLength(0)
    expect(approximate.approximate).toHaveLength(1)
  })
})

describe('feedback service', () => {
  it('traces to the originating run', async () => {
    const { auth, workspaces, runs, specs, feedback } = build()
    const user = await register(auth, 'alice@example.com')
    const personal = (await workspaces.getPersonalWorkspace(user.id))!
    seedRun(runs, specs, { runId: 'run-1', workspaceId: personal.id, ownerId: user.id })

    const record = await feedback.submit({
      runId: 'run-1',
      content: 'the analysis missed the retry path',
      actorUserId: user.id,
    })
    expect(record.runId).toEqual({ id: 'run-1', kind: 'run' })
    expect(record.provenance.derivedFrom).toEqual([{ id: 'run-1', kind: 'run' }])
  })

  it('rejects feedback from a non-member (cross-workspace)', async () => {
    const { auth, workspaces, runs, specs, feedback } = build()
    const alice = await register(auth, 'alice@example.com')
    const bob = await register(auth, 'bob@example.com')
    const alicePersonal = (await workspaces.getPersonalWorkspace(alice.id))!
    seedRun(runs, specs, { runId: 'run-1', workspaceId: alicePersonal.id, ownerId: alice.id })

    await expect(
      feedback.submit({ runId: 'run-1', content: 'interloper feedback', actorUserId: bob.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('Run -> Feedback -> MemoryCandidate on apply', async () => {
    const { auth, workspaces, runs, specs, feedback, memoryRepo } = build()
    const user = await register(auth, 'alice@example.com')
    const personal = (await workspaces.getPersonalWorkspace(user.id))!
    seedRun(runs, specs, { runId: 'run-1', workspaceId: personal.id, ownerId: user.id })

    const submitted = await feedback.submit({
      runId: 'run-1',
      content: 'the retry path should be cached',
      actorUserId: user.id,
    })
    await feedback.triage(submitted.id)
    await feedback.accept(submitted.id)
    const applied = await feedback.apply(submitted.id)

    expect(applied.status).toBe('applied')
    const candidates = memoryRepo.all().filter((entry) => entry.status === 'candidate')
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.sourceRun).toEqual({ id: 'run-1', kind: 'run' })
    expect(candidates[0]!.content).toBe('the retry path should be cached')
  })
})

describe('memory service', () => {
  it('enforces private write scope', async () => {
    const { auth, workspaces, memory } = build()
    const alice = await register(auth, 'alice@example.com')
    const bob = await register(auth, 'bob@example.com')
    const alicePersonal = (await workspaces.getPersonalWorkspace(alice.id))!

    await expect(
      memory.createCandidate({
        workspaceId: alicePersonal.id,
        ownerId: alice.id,
        scope: 'private',
        content: 'my secret',
        actorUserId: bob.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('enforces cross-workspace memory retrieval denial', async () => {
    const { auth, workspaces, memory } = build()
    const alice = await register(auth, 'alice@example.com')
    const bob = await register(auth, 'bob@example.com')
    const alicePersonal = (await workspaces.getPersonalWorkspace(alice.id))!

    const entry = await memory.createCandidate({
      workspaceId: alicePersonal.id,
      ownerId: alice.id,
      scope: 'workspace',
      content: 'alice workspace memory',
      actorUserId: alice.id,
    })

    // Bob cannot list Alice's workspace memory.
    const bobsMemory = await memory.listForUser(bob.id)
    expect(bobsMemory.map((entry) => entry.id)).not.toContain(entry.id)

    // Bob cannot read the specific entry.
    await expect(memory.get(entry.id, bob.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })

    // Alice can.
    expect((await memory.get(entry.id, alice.id)).id).toBe(entry.id)
  })

  it('runtime memory output remains a candidate (never promoted)', async () => {
    const { auth, workspaces, runs, specs, memory, memoryRepo } = build()
    const user = await register(auth, 'alice@example.com')
    const personal = (await workspaces.getPersonalWorkspace(user.id))!
    seedRun(runs, specs, { runId: 'run-1', workspaceId: personal.id, ownerId: user.id })

    await memory.ingestRunCandidates('run-1', ['remember the retry path', '  '])

    const entries = memoryRepo.all()
    expect(entries).toHaveLength(1)
    expect(entries[0]!.status).toBe('candidate')
    expect(entries[0]!.sourceRun).toEqual({ id: 'run-1', kind: 'run' })
    expect(entries[0]!.scope).toBe('workspace')
  })

  it('promotes a candidate only with write authorization', async () => {
    const { auth, workspaces, memory } = build()
    const alice = await register(auth, 'alice@example.com')
    const bob = await register(auth, 'bob@example.com')
    const alicePersonal = (await workspaces.getPersonalWorkspace(alice.id))!

    const entry = await memory.createCandidate({
      workspaceId: alicePersonal.id,
      ownerId: alice.id,
      scope: 'workspace',
      content: 'a promotable candidate',
      actorUserId: alice.id,
    })

    await expect(memory.promote(entry.id, bob.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect((await memory.promote(entry.id, alice.id)).status).toBe('promoted')
  })

  it('shared memory is readable by any authenticated user', async () => {
    const { auth, workspaces, memory } = build()
    const alice = await register(auth, 'alice@example.com')
    const bob = await register(auth, 'bob@example.com')
    const alicePersonal = (await workspaces.getPersonalWorkspace(alice.id))!

    const entry = await memory.createCandidate({
      workspaceId: alicePersonal.id,
      ownerId: alice.id,
      scope: 'shared',
      content: 'shared insight',
      actorUserId: alice.id,
    })

    expect((await memory.get(entry.id, bob.id)).id).toBe(entry.id)
    expect((await memory.listForUser(bob.id)).map((entry) => entry.id)).toContain(entry.id)
  })
})
