import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { Pool } from 'pg'
import { createAppServices } from '../app'
import { runMigrations } from '../infrastructure/migrate'
import type { AppServices } from '../app'
import type { RunView } from '../services/run-engine'

/**
 * Canonical vertical E2E: the complete Element Plus v1 chain through the real
 * service graph against real PostgreSQL.
 *
 *   new user -> personal workspace -> Founder -> raw problem -> SPS ->
 *   confirmed ProblemSpecification -> capability resolution -> Process ->
 *   Island -> Run (FAKE RUNTIME; OpenClaw live is NOT RUN here) ->
 *   approval (external_reversible) -> Result -> Evaluation -> Feedback ->
 *   scoped Memory -> VersionProposal -> governed version change ->
 *   Asset publication -> second workspace forks + installs exact version.
 */

let db: PGlite
let server: PGLiteSocketServer
let pool: Pool
let app: AppServices
let databaseUrl: string

beforeAll(async () => {
  db = await PGlite.create()
  server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 10 })
  await server.start()

  const conn = server.getServerConn()
  const port = Number(conn.split(':').pop())
  databaseUrl = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`

  pool = new Pool({ connectionString: databaseUrl, max: 5 })
  await runMigrations(pool)

  app = createAppServices({
    databaseUrl,
    authSecret: 'vertical-e2e-secret-that-is-long-enough',
    pool,
  })
})

afterAll(async () => {
  await app.close()
  await server.stop()
  await db.close()
})

async function waitForRunStatus(
  runId: string,
  statuses: string[],
  userId: string,
  timeoutMs = 5000,
): Promise<RunView> {
  const start = Date.now()
  let view: RunView
  do {
    view = await app.runs.get({ id: userId }, runId)
    if (statuses.includes(view.run.status)) return view
    await new Promise((resolve) => setTimeout(resolve, 10))
  } while (Date.now() - start < timeoutMs)
  return view
}

const email = () => `vertical-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

describe('Element Plus vertical proof', () => {
  it('completes the full v1 chain', async () => {
    // 1. new user
    const alice = await app.auth.register({
      email: email(),
      password: 'password123',
      displayName: 'Alice Vertical',
    })

    // 2. personal workspace
    const personal = await app.workspaces.getPersonalWorkspace(alice.user.id)
    expect(personal).not.toBeNull()

    // 3-4. Founder: raw problem -> SPS -> confirmed ProblemSpecification
    const raw = 'Checkout fails at the payment step when a card is declined, with no retry.'
    const founder = await app.founder.start(alice.user, personal!.id, raw)
    expect(founder.session.status).toBe('review')
    expect(founder.draft!.version).toBe('1.0.0')

    const confirmed = await app.founder.confirm(alice.user, personal!.id, founder.session.id)
    expect(confirmed.confirmed!.status).toBe('confirmed')
    const specId = confirmed.confirmed!.id

    // 5. capability resolution + Island (reuse before create)
    const island = await app.islands.ensureReferenceIsland({ actorUserId: alice.user.id })
    expect(island.island.status).toBe('active')

    // 6. Process
    const process = await app.processes.createDraft({
      title: 'Analysis Process',
      description: 'structured analysis process for the vertical',
      steps: [
        {
          id: 's1',
          order: 0,
          title: 'analyze',
          instruction: 'analyze the problem',
          dependsOn: [],
          status: 'pending',
        },
      ],
      actorUserId: alice.user.id,
    })
    await app.processes.publish(process.id)

    // 7. Run (FAKE RUNTIME — OpenClaw live is NOT RUN in this environment)
    const run = await app.runs.enqueue({
      actorUserId: alice.user.id,
      islandId: island.island.id,
      problemSpecId: specId,
      processId: process.id,
    })
    const runView = await waitForRunStatus(run.id, ['completed'], alice.user.id)
    expect(runView.run.status).toBe('completed')
    expect(runView.artifacts).toHaveLength(1)

    // 8. Evaluation
    const evaluation = await app.runs.evaluate({ id: alice.user.id }, run.id, {
      verdict: 'pass',
      score: 0.9,
    })
    expect(evaluation.verdict).toBe('pass')

    // 9. Feedback -> scoped Memory
    const submitted = await app.feedback.submit({
      runId: run.id,
      content: 'the retry path should be cached',
      actorUserId: alice.user.id,
    })
    await app.feedback.triage(submitted.id)
    await app.feedback.accept(submitted.id)
    await app.feedback.apply(submitted.id)

    const memory = await app.memory.listWorkspace(alice.user.id, personal!.id)
    const candidate = memory.find((entry) => entry.sourceRun?.id === run.id)
    expect(candidate).toBeDefined()
    expect(candidate!.status).toBe('candidate')

    // 10. VersionProposal -> governed version change (knowledge)
    const knowledge = await app.knowledge.createDraft({
      workspaceId: personal!.id,
      ownerId: alice.user.id,
      title: 'Retry guidance',
      content: 'always retry with backoff',
      evidenceRefs: [{ id: 'ev-1', kind: 'evidence' }],
      actorUserId: alice.user.id,
    })
    await app.knowledge.publish(knowledge.id)

    const proposal = await app.proposals.propose({
      target: { id: knowledge.id, kind: 'knowledge' },
      fromVersion: '1.0.0',
      toVersion: '1.0.1',
      rationale: 'feedback/evaluation from the run',
      content: 'always retry with exponential backoff',
      actorUserId: alice.user.id,
    })
    await app.proposals.review(proposal.id)
    await app.proposals.approve(proposal.id)
    await app.proposals.merge(proposal.id, alice.user.id)

    const knowledgeVersions = await app.knowledge.listVersions(knowledge.id)
    expect(knowledgeVersions.map((entry) => entry.version).sort()).toEqual(['1.0.0', '1.0.1'])
    expect(knowledgeVersions.find((entry) => entry.version === '1.0.0')!.status).toBe('superseded')

    // 11. Asset publication
    const asset = await app.assets.register({
      kind: 'island',
      name: 'Reusable Analysis Island',
      description: 'the reference analysis island as a distributable asset',
      license: 'MIT',
      contentRef: { id: island.island.id, kind: 'island' },
      actorUserId: alice.user.id,
    })
    await app.assets.publish(asset.id, alice.user.id)

    // 12. second workspace installs + forks the exact asset version
    const bob = await app.auth.register({
      email: email(),
      password: 'password123',
      displayName: 'Bob Vertical',
    })
    const bobPersonal = await app.workspaces.getPersonalWorkspace(bob.user.id)

    const install = await app.assets.install(asset.id, '1.0.0', bobPersonal!.id, bob.user.id)
    expect(install.version).toBe('1.0.0')

    const fork = await app.assets.fork(asset.id, bob.user.id)
    expect(fork.asset.id).not.toBe(asset.id)
    expect(fork.asset.provenance.derivedFrom).toContainEqual({ id: asset.id, kind: 'asset' })
  })

  it('proves the approval semantics: external_reversible pauses, approve executes', async () => {
    const user = await app.auth.register({
      email: email(),
      password: 'password123',
      displayName: 'Approval Vertical',
    })
    const personal = (await app.workspaces.getPersonalWorkspace(user.user.id))!

    const founder = await app.founder.start(user.user, personal.id, 'Approval vertical problem.')
    const confirmed = await app.founder.confirm(user.user, personal.id, founder.session.id)

    const island = await app.islands.ensureControlledActionIsland({ actorUserId: user.user.id })
    const run = await app.runs.enqueue({
      actorUserId: user.user.id,
      islandId: island.island.id,
      problemSpecId: confirmed.confirmed!.id,
    })

    const paused = await waitForRunStatus(run.id, ['awaiting_approval'], user.user.id)
    expect(paused.approvals[0]!.effectKind).toBe('external_reversible')

    await app.runs.decideApproval({ id: user.user.id }, run.id, paused.approvals[0]!.id, 'approve')
    const done = await waitForRunStatus(run.id, ['completed'], user.user.id)
    expect(done.effects).toHaveLength(1)
    expect(done.effects[0]!.kind).toBe('external_reversible')
  })
})
