import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { Pool } from 'pg'
import { createAppServices } from '../app'
import { runMigrations } from '../infrastructure/migrate'
import type { AppServices } from '../app'

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
})
