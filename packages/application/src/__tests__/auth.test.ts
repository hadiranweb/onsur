import { describe, expect, it } from 'vitest'
import { AuthService } from '../services/auth-service'
import { WorkspaceService } from '../services/workspace-service'
import { AppError } from '../errors'
import {
  FakePasswordHasher,
  FakeSessionCodec,
  InMemoryMembershipRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
} from './fakes'

function buildServices() {
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
  return { auth, users, sessions, memberships, workspaces }
}

describe('registration', () => {
  it('registers a user, hashes the password, and creates a personal workspace', async () => {
    const { auth, users, memberships } = buildServices()
    const result = await auth.register({
      email: 'Ada@Example.COM',
      password: 'password123',
      displayName: 'Ada',
    })

    expect(result.user.email).toBe('ada@example.com')
    expect(result.user.passwordHash).toBe('fake:password123')
    expect(result.user.passwordHash).not.toBe('password123')
    expect(result.cookieValue).toMatch(/^cookie\(/)

    const stored = await users.findByEmail('ada@example.com')
    expect(stored).not.toBeNull()

    const membershipsList = await memberships.listByUser(result.user.id)
    expect(membershipsList).toHaveLength(1)
    expect(membershipsList[0]!.role).toBe('owner')
  })

  it('rejects a duplicate email', async () => {
    const { auth } = buildServices()
    await auth.register({ email: 'ada@example.com', password: 'password123', displayName: 'Ada' })
    await expect(
      auth.register({ email: 'ada@example.com', password: 'password456', displayName: 'Ada 2' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
  })

  it('rejects a weak password', async () => {
    const { auth } = buildServices()
    await expect(
      auth.register({ email: 'ada@example.com', password: 'short', displayName: 'Ada' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
})

describe('login', () => {
  it('logs in with correct credentials and returns a session cookie', async () => {
    const { auth } = buildServices()
    await auth.register({ email: 'ada@example.com', password: 'password123', displayName: 'Ada' })

    const result = await auth.login({ email: 'ada@example.com', password: 'password123' })
    expect(result.user.email).toBe('ada@example.com')
    expect(result.cookieValue).toMatch(/^cookie\(/)
  })

  it('rejects a wrong password without revealing which field is wrong', async () => {
    const { auth } = buildServices()
    await auth.register({ email: 'ada@example.com', password: 'password123', displayName: 'Ada' })
    await expect(
      auth.login({ email: 'ada@example.com', password: 'wrong-password' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('rejects an unknown email with the same error as a wrong password', async () => {
    const { auth } = buildServices()
    await expect(
      auth.login({ email: 'nobody@example.com', password: 'whatever' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })
})

describe('sessions', () => {
  it('resolves a valid cookie to the user', async () => {
    const { auth } = buildServices()
    const { cookieValue, user } = await auth.register({
      email: 'ada@example.com',
      password: 'password123',
      displayName: 'Ada',
    })
    const resolved = await auth.getUserForCookie(cookieValue)
    expect(resolved?.id).toBe(user.id)
  })

  it('rejects a tampered or malformed cookie', async () => {
    const { auth } = buildServices()
    await auth.register({ email: 'ada@example.com', password: 'password123', displayName: 'Ada' })
    expect(await auth.getUserForCookie('cookie(tampered')).toBeNull()
    expect(await auth.getUserForCookie(null)).toBeNull()
    expect(await auth.getUserForCookie(undefined)).toBeNull()
    expect(await auth.getUserForCookie('nonsense')).toBeNull()
  })

  it('rejects a revoked session', async () => {
    const { auth } = buildServices()
    const { cookieValue } = await auth.register({
      email: 'ada@example.com',
      password: 'password123',
      displayName: 'Ada',
    })
    expect(await auth.getUserForCookie(cookieValue)).not.toBeNull()

    await auth.logout(cookieValue)
    expect(await auth.getUserForCookie(cookieValue)).toBeNull()
  })

  it('logout is idempotent', async () => {
    const { auth } = buildServices()
    const { cookieValue } = await auth.register({
      email: 'ada@example.com',
      password: 'password123',
      displayName: 'Ada',
    })
    await auth.logout(cookieValue)
    await expect(auth.logout(cookieValue)).resolves.toBeUndefined()
  })

  it('revokeAllForUser invalidates every session for that user', async () => {
    const { auth } = buildServices()
    await auth.register({ email: 'ada@example.com', password: 'password123', displayName: 'Ada' })
    const login = await auth.login({ email: 'ada@example.com', password: 'password123' })

    await auth.revokeAllForUser(login.user.id)
    expect(await auth.getUserForCookie(login.cookieValue)).toBeNull()
  })
})

describe('error taxonomy', () => {
  it('maps AppError codes to HTTP statuses', () => {
    expect(new AppError('FORBIDDEN', 'no').status).toBe(403)
    expect(new AppError('UNAUTHENTICATED', 'no').status).toBe(401)
    expect(new AppError('NOT_FOUND', 'no').status).toBe(404)
    expect(new AppError('CONFLICT', 'no').status).toBe(409)
    expect(new AppError('EMAIL_TAKEN', 'no').status).toBe(409)
  })
})
