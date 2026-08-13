import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { Pool } from 'pg'
import { createAppServices } from '../app'
import { createPostgresRepositories } from '../infrastructure/postgres-repositories'
import { InMemoryToolRegistry } from '../infrastructure/tool-registry'
import { FakeRuntimeAdapter } from '../infrastructure/fake-runtime-adapter'
import { RunEngine } from '../services/run-engine'
import { runMigrations } from '../infrastructure/migrate'
import type { AppServices } from '../app'
import type { RunView } from '../services/run-engine'

/**
 * Integration tests against real PostgreSQL semantics (PGlite engine served
 * over the standard wire protocol, driven through the `pg` adapter).
 *
 * These prove migrations + adapters + the full registration/login/authorization
 * flow end-to-end. They are self-contained (no external server), so they run
 * anywhere the dependencies install.
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

  const conn = server.getServerConn() // e.g. "127.0.0.1:54321"
  const port = Number(conn.split(':').pop())
  databaseUrl = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`

  pool = new Pool({ connectionString: databaseUrl, max: 5 })
  await runMigrations(pool)

  app = createAppServices({
    databaseUrl,
    authSecret: 'test-secret-that-is-long-enough',
    pool,
  })
})

afterAll(async () => {
  await app.close()
  await server.stop()
  await db.close()
})

const uniqueEmail = () => `it-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

describe('postgres persistence (integration)', () => {
  it('applies migrations idempotently', async () => {
    // Second run must apply nothing and succeed.
    const appliedAgain = await runMigrations(pool)
    expect(appliedAgain).toEqual([])
  })

  it('registers, logs in, and resolves the session through real persistence', async () => {
    const email = uniqueEmail()
    const registered = await app.auth.register({
      email,
      password: 'password123',
      displayName: 'Integration User',
    })

    expect(registered.user.email).toBe(email)

    const resolved = await app.auth.getUserForCookie(registered.cookieValue)
    expect(resolved?.id).toBe(registered.user.id)

    const loggedIn = await app.auth.login({ email, password: 'password123' })
    expect(loggedIn.user.id).toBe(registered.user.id)
  })

  it('creates the personal workspace exactly once', async () => {
    const email = uniqueEmail()
    const registered = await app.auth.register({
      email,
      password: 'password123',
      displayName: 'Idempotent User',
    })

    const first = await app.workspaces.createPersonalWorkspace(registered.user)
    const second = await app.workspaces.createPersonalWorkspace(registered.user)
    expect(first.id).toBe(second.id)

    const list = await app.workspaces.listForUser(registered.user.id)
    expect(list.filter((entry) => entry.workspace.kind === 'personal')).toHaveLength(1)
  })

  it('rejects a duplicate email at the database level', async () => {
    const email = uniqueEmail()
    await app.auth.register({ email, password: 'password123', displayName: 'First' })
    await expect(
      app.auth.register({ email, password: 'password456', displayName: 'Second' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
  })

  it('enforces cross-workspace isolation', async () => {
    const alice = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Alice',
    })
    const bob = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Bob',
    })

    const bobsTeam = await app.workspaces.createTeamWorkspace(bob.user, {
      name: 'Bobs Team',
      slug: `bob-${bob.user.id.slice(0, 8)}`,
    })

    await expect(app.workspaces.assertAccess(alice.user.id, bobsTeam.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(app.workspaces.assertAccess(bob.user.id, bobsTeam.id)).resolves.toMatchObject({
      role: 'owner',
    })
  })

  it('rejects a revoked session', async () => {
    const registered = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Revoke Me',
    })
    expect(await app.auth.getUserForCookie(registered.cookieValue)).not.toBeNull()

    await app.auth.logout(registered.cookieValue)
    expect(await app.auth.getUserForCookie(registered.cookieValue)).toBeNull()
  })

  it('runs the full Founder flow through real persistence', async () => {
    const registered = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Founder IT',
    })
    const personal = await app.workspaces.getPersonalWorkspace(registered.user.id)
    expect(personal).not.toBeNull()

    const raw = 'Deployments fail intermittently when the database migration runs.'
    const started = await app.founder.start(registered.user, personal!.id, raw)

    expect(started.session.status).toBe('review')
    expect(started.draft).not.toBeNull()
    expect(started.draft!.version).toBe('1.0.0')
    expect(started.problem.rawProblem).toBe(raw)

    const corrected = await app.founder.correct(
      registered.user,
      personal!.id,
      started.session.id,
      'Failures correlate with concurrent deploys.',
    )
    expect(corrected.draft!.version).toBe('1.0.1')

    const confirmed = await app.founder.confirm(registered.user, personal!.id, started.session.id)
    expect(confirmed.session.status).toBe('confirmed')
    expect(confirmed.confirmed!.version).toBe('1.0.1')
    expect(confirmed.confirmed!.status).toBe('confirmed')
    expect(confirmed.confirmed!.rawProblem).toBe(raw)
  })

  it('enforces Founder cross-workspace isolation through real persistence', async () => {
    const alice = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Alice F',
    })
    const bob = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Bob F',
    })
    const alicePersonal = await app.workspaces.getPersonalWorkspace(alice.user.id)
    const bobPersonal = await app.workspaces.getPersonalWorkspace(bob.user.id)

    const session = await app.founder.start(alice.user, alicePersonal!.id, 'Alice problem.')

    await expect(
      app.founder.get(bob.user, bobPersonal!.id, session.session.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      app.founder.confirm(bob.user, alicePersonal!.id, session.session.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('registers a capability and rejects a duplicate name', async () => {
    const actor = (
      await app.auth.register({
        email: uniqueEmail(),
        password: 'password123',
        displayName: 'Cap Actor',
      })
    ).user

    const capability = await app.capabilities.register({
      name: `Search ${uniqueEmail()}`,
      description: 'search the web',
      actorUserId: actor.id,
    })
    expect(capability.version).toBe('1.0.0')

    await expect(
      app.capabilities.register({
        name: capability.name,
        description: 'again',
        actorUserId: actor.id,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('runs the full process + island lifecycle through real persistence', async () => {
    const actor = (
      await app.auth.register({
        email: uniqueEmail(),
        password: 'password123',
        displayName: 'Registry Actor',
      })
    ).user

    const process = await app.processes.createDraft({
      title: 'Analyze IT',
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
      actorUserId: actor.id,
    })
    expect((await app.processes.publish(process.id)).status).toBe('published')

    const island = await app.islands.createDraft({
      manifest: {
        name: 'IT Island',
        description: 'integration island',
        capabilities: [{ id: 'cap-it', kind: 'capability' }],
        runtime: { runtime: 'fake', config: {} },
        permissions: [],
      },
      actorUserId: actor.id,
    })
    expect((await app.islands.activate(island.id)).status).toBe('active')

    const resolved = await app.islands.resolve(['cap-it'])
    expect(resolved?.island.id).toBe(island.id)

    const next = await app.islands.newVersion(island.id, { description: 'revised' }, actor.id)
    expect(next.version).toBe('1.0.1')
  })

  it('ensureReferenceIsland is idempotent through real persistence', async () => {
    const actor = (
      await app.auth.register({
        email: uniqueEmail(),
        password: 'password123',
        displayName: 'Ref Actor',
      })
    ).user

    const first = await app.islands.ensureReferenceIsland({ actorUserId: actor.id })
    const second = await app.islands.ensureReferenceIsland({ actorUserId: actor.id })
    expect(first.reused).toBe(false)
    expect(second.reused).toBe(true)
    expect(second.island.id).toBe(first.island.id)
  })

  it('runs the Structured Analysis island end-to-end on the fake runtime (real persistence)', async () => {
    const registered = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Run Actor',
    })
    const personal = await app.workspaces.getPersonalWorkspace(registered.user.id)

    const ref = await app.islands.ensureReferenceIsland({ actorUserId: registered.user.id })
    const started = await app.founder.start(
      registered.user,
      personal!.id,
      'Integration problem for a structured analysis run.',
    )
    const confirmed = await app.founder.confirm(registered.user, personal!.id, started.session.id)
    const specId = confirmed.confirmed!.id

    const run = await app.runs.enqueue({
      actorUserId: registered.user.id,
      islandId: ref.island.id,
      problemSpecId: specId,
    })

    const view = await waitForRunStatus(app.runs, run.id, ['completed'])
    expect(view.run.status).toBe('completed')
    expect(view.artifacts).toHaveLength(1)
    expect(view.toolCalls[0]!.toolName).toBe('Analyze')
    expect(view.effects).toHaveLength(0)

    const evaluation = await app.runs.evaluate({ id: registered.user.id }, run.id, {
      verdict: 'pass',
      score: 0.8,
    })
    expect(evaluation.verdict).toBe('pass')
  })

  it('records a rejected irreversible effect without executing it (real persistence)', async () => {
    const registered = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Reject Actor',
    })
    const personal = await app.workspaces.getPersonalWorkspace(registered.user.id)

    const ref = await app.islands.ensureReferenceIsland({ actorUserId: registered.user.id })
    const started = await app.founder.start(
      registered.user,
      personal!.id,
      'Problem that will trigger an irreversible effect.',
    )
    const confirmed = await app.founder.confirm(registered.user, personal!.id, started.session.id)

    // A second run engine over the same pool with a script that requests the
    // irreversible tool.
    const repos = createPostgresRepositories(pool)
    const engine = new RunEngine({
      runs: repos.runs,
      approvals: repos.approvals,
      toolCalls: repos.toolCalls,
      effects: repos.effects,
      artifacts: repos.artifacts,
      evaluations: repos.evaluations,
      specifications: repos.specifications,
      registry: new InMemoryToolRegistry(),
      islands: app.islands,
      processes: app.processes,
      runtimeFactory: (_island, gate) =>
        new FakeRuntimeAdapter({
          script: [{ toolId: 'tool-send-email', arguments: { to: 'x@example.com' } }],
          gate,
        }),
    })

    const run = await engine.enqueue({
      actorUserId: registered.user.id,
      islandId: ref.island.id,
      problemSpecId: confirmed.confirmed!.id,
    })

    const paused = await waitForRunStatus(engine, run.id, ['awaiting_approval'])
    expect(paused.approvals[0]!.status).toBe('pending')

    await engine.decideApproval(
      { id: registered.user.id },
      run.id,
      paused.approvals[0]!.id,
      'reject',
    )

    const view = await waitForRunStatus(engine, run.id, ['completed'])
    expect(view.run.status).toBe('completed')
    expect(view.toolCalls[0]!.status).toBe('rejected')
    expect(view.effects).toHaveLength(0)
    expect(view.approvals[0]!.status).toBe('rejected')
    expect(view.events.map((event) => event.type)).toContain('reject')
  })

  it('runs the evidence lifecycle with duplicate detection through real persistence', async () => {
    const registered = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Evidence Actor',
    })
    const personal = (await app.workspaces.getPersonalWorkspace(registered.user.id))!

    const intake = await app.evidence.intake({
      workspaceId: personal.id,
      kind: 'evidence',
      content: 'the deployment failed on the database migration step',
      actorUserId: registered.user.id,
    })
    expect(intake.status).toBe('intake')
    expect(intake.fingerprint).toMatch(/^sha256:/)

    expect((await app.evidence.submit(intake.id)).status).toBe('pending_review')
    expect((await app.evidence.accept(intake.id)).status).toBe('accepted')

    const duplicates = await app.evidence.findDuplicates(
      personal.id,
      'the deployment failed on the database migration step',
    )
    expect(duplicates.exact.map((entry) => entry.id)).toContain(intake.id)
  })

  it('runs feedback -> memory candidate through real persistence', async () => {
    const registered = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Feedback Actor',
    })
    const personal = (await app.workspaces.getPersonalWorkspace(registered.user.id))!
    const ref = await app.islands.ensureReferenceIsland({ actorUserId: registered.user.id })
    const started = await app.founder.start(
      registered.user,
      personal.id,
      'Feedback integration problem statement.',
    )
    const confirmed = await app.founder.confirm(registered.user, personal.id, started.session.id)
    const run = await app.runs.enqueue({
      actorUserId: registered.user.id,
      islandId: ref.island.id,
      problemSpecId: confirmed.confirmed!.id,
    })
    await waitForRunStatus(app.runs, run.id, ['completed'])

    const submitted = await app.feedback.submit({
      runId: run.id,
      content: 'the retry path should be cached',
      actorUserId: registered.user.id,
    })
    expect(submitted.runId.id).toBe(run.id)

    await app.feedback.triage(submitted.id)
    await app.feedback.accept(submitted.id)
    await app.feedback.apply(submitted.id)

    const memory = await app.memory.listWorkspace(registered.user.id, personal.id)
    expect(memory).toHaveLength(1)
    expect(memory[0]!.status).toBe('candidate')
    expect(memory[0]!.sourceRun).toEqual({ id: run.id, kind: 'run' })
  })

  it('denies cross-workspace memory retrieval through real persistence', async () => {
    const alice = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Alice M',
    })
    const bob = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Bob M',
    })
    const alicePersonal = (await app.workspaces.getPersonalWorkspace(alice.user.id))!
    const bobPersonal = (await app.workspaces.getPersonalWorkspace(bob.user.id))!

    const entry = await app.memory.createCandidate({
      workspaceId: alicePersonal.id,
      ownerId: alice.user.id,
      scope: 'workspace',
      content: 'alice workspace private memory',
      actorUserId: alice.user.id,
    })

    const bobsList = await app.memory.listForUser(bob.user.id)
    expect(bobsList.map((entry) => entry.id)).not.toContain(entry.id)

    await expect(app.memory.listWorkspace(bob.user.id, alicePersonal.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    await expect(app.memory.get(entry.id, bob.user.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(bobPersonal.id).not.toBe(alicePersonal.id)
  })

  it('runs knowledge governance: proposal approval produces a new version preserving the old', async () => {
    const registered = await app.auth.register({
      email: uniqueEmail(),
      password: 'password123',
      displayName: 'Gov Actor',
    })
    const personal = (await app.workspaces.getPersonalWorkspace(registered.user.id))!

    const draft = await app.knowledge.createDraft({
      workspaceId: personal.id,
      ownerId: registered.user.id,
      title: 'Retry guidance',
      content: 'always retry with backoff',
      evidenceRefs: [{ id: 'ev-1', kind: 'evidence' }],
      actorUserId: registered.user.id,
    })
    await app.knowledge.publish(draft.id)

    const proposal = await app.proposals.propose({
      target: { id: draft.id, kind: 'knowledge' },
      fromVersion: '1.0.0',
      toVersion: '1.0.1',
      rationale: 'new evidence',
      content: 'always retry with exponential backoff',
      evidenceRefs: [{ id: 'ev-2', kind: 'evidence' }],
      actorUserId: registered.user.id,
    })
    await app.proposals.review(proposal.id)
    await app.proposals.approve(proposal.id)
    await app.proposals.merge(proposal.id, registered.user.id)

    const versions = await app.knowledge.listVersions(draft.id)
    expect(versions.map((entry) => entry.version).sort()).toEqual(['1.0.0', '1.0.1'])
    expect(versions.find((entry) => entry.version === '1.0.0')!.status).toBe('superseded')
    expect(versions.find((entry) => entry.version === '1.0.1')!.status).toBe('published')
    expect(versions.find((entry) => entry.version === '1.0.1')!.content).toBe(
      'always retry with exponential backoff',
    )
  })

  it('publishes a package atomically (outbox + package event in one transaction)', async () => {
    const message = await app.packages.publish({
      kind: 'command',
      connectorId: 'relay',
      correlationId: 'corr-it-1',
      payload: { op: 'go' },
      actorUserId: 'system',
    })
    expect(message.status).toBe('pending')

    const outbox = await app.packages.getOutbox()
    expect(outbox.map((entry) => entry.id)).toContain(message.id)

    const eventResult = await pool.query(
      `SELECT id FROM package_events WHERE correlation_id = 'corr-it-1'`,
    )
    expect(eventResult.rows).toHaveLength(1)
  })

  it('delivers through the relay connector with correlation surviving, idempotently', async () => {
    // Flush any pending messages from earlier tests for a deterministic batch.
    await app.packages.deliverPending(100)

    await app.packages.publish({
      kind: 'command',
      connectorId: 'relay',
      correlationId: 'corr-it-2',
      payload: { op: 'deliver' },
      actorUserId: 'system',
    })

    const delivered = await app.packages.deliverPending(10)
    expect(delivered).toBe(1)

    const deliveryResult = await pool.query(
      `SELECT correlation_id FROM connector_deliveries WHERE correlation_id = 'corr-it-2'`,
    )
    expect(deliveryResult.rows).toHaveLength(1)
    expect(deliveryResult.rows[0].correlation_id).toBe('corr-it-2')

    // Duplicate delivery must NOT duplicate the effect (idempotent).
    await app.packages.deliverPending(10)
    const still = await pool.query(
      `SELECT COUNT(*)::int AS n FROM connector_deliveries WHERE correlation_id = 'corr-it-2'`,
    )
    expect(still.rows[0].n).toBe(1)
  })

  it('reports honest connector status', async () => {
    const connector = app.packages.getConnector('relay')
    expect(connector).toBeDefined()
    expect(await connector!.check()).toEqual({ status: 'connected' })
    expect(app.packages.getConnector('missing')).toBeUndefined()
  })
})

async function waitForRunStatus(
  engine: RunEngine,
  runId: string,
  statuses: string[],
  timeoutMs = 5000,
): Promise<RunView> {
  const start = Date.now()
  let view: RunView
  do {
    view = await engine.get(runId)
    if (statuses.includes(view.run.status)) return view
    await new Promise((resolve) => setTimeout(resolve, 10))
  } while (Date.now() - start < timeoutMs)
  return view
}
