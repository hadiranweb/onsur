import { describe, expect, it } from 'vitest'
import { AuthService } from '../services/auth-service'
import { WorkspaceService } from '../services/workspace-service'
import {
  FakePasswordHasher,
  FakeSessionCodec,
  InMemoryMembershipRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
} from './fakes'

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
  return { auth, users, workspaces, memberships }
}

async function registerUser(auth: AuthService, email: string) {
  const result = await auth.register({
    email,
    password: 'password123',
    displayName: email.split('@')[0] ?? 'User',
  })
  return result.user
}

describe('personal workspace', () => {
  it('is created during registration with owner membership', async () => {
    const { workspaces, memberships } = build()
    // register via a separate builder to get a user + workspace
    const { auth } = build()
    const user = await registerUser(auth, 'ada@example.com')

    const personal = await workspaces.createPersonalWorkspace(user)
    const membership = await memberships.findByWorkspaceAndUser(personal.id, user.id)
    expect(membership?.role).toBe('owner')
  })

  it('is created idempotently (same workspace returned on repeat calls)', async () => {
    const { auth, workspaces } = build()
    const user = await registerUser(auth, 'ada@example.com')

    const first = await workspaces.createPersonalWorkspace(user)
    const second = await workspaces.createPersonalWorkspace(user)

    expect(first.id).toBe(second.id)
    expect(first.kind).toBe('personal')
  })
})

describe('team workspaces', () => {
  it('creates a workspace with owner membership', async () => {
    const { auth, workspaces, memberships } = build()
    const user = await registerUser(auth, 'ada@example.com')

    const workspace = await workspaces.createTeamWorkspace(user, { name: 'Team A', slug: 'team-a' })
    expect(workspace.kind).toBe('team')
    expect((await memberships.findByWorkspaceAndUser(workspace.id, user.id))?.role).toBe('owner')
  })

  it('rejects a duplicate slug', async () => {
    const { auth, workspaces } = build()
    const user = await registerUser(auth, 'ada@example.com')
    await workspaces.createTeamWorkspace(user, { name: 'Team A', slug: 'team-a' })

    await expect(
      workspaces.createTeamWorkspace(user, { name: 'Team A2', slug: 'team-a' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('workspace authorization (default deny)', () => {
  it('lists only the workspaces a user belongs to', async () => {
    const { auth, workspaces } = build()
    const ada = await registerUser(auth, 'ada@example.com')
    const bob = await registerUser(auth, 'bob@example.com')

    await workspaces.createTeamWorkspace(bob, { name: 'Bobs Team', slug: 'bobs-team' })

    const adaList = await workspaces.listForUser(ada.id)
    const bobList = await workspaces.listForUser(bob.id)

    expect(adaList.map((entry) => entry.workspace.slug)).not.toContain('bobs-team')
    expect(bobList.map((entry) => entry.workspace.slug)).toContain('bobs-team')
  })

  it('allows a member to access their own workspace', async () => {
    const { auth, workspaces } = build()
    const ada = await registerUser(auth, 'ada@example.com')
    const personal = await workspaces.createPersonalWorkspace(ada)

    await expect(workspaces.assertAccess(ada.id, personal.id)).resolves.toMatchObject({
      role: 'owner',
    })
  })

  it('rejects cross-workspace access (member of A accessing B)', async () => {
    const { auth, workspaces } = build()
    const ada = await registerUser(auth, 'ada@example.com')
    const bob = await registerUser(auth, 'bob@example.com')
    const bobsTeam = await workspaces.createTeamWorkspace(bob, {
      name: 'Bobs Team',
      slug: 'bobs-team',
    })

    await expect(workspaces.assertAccess(ada.id, bobsTeam.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('rejects access to a workspace that does not exist', async () => {
    const { auth, workspaces } = build()
    const ada = await registerUser(auth, 'ada@example.com')
    await expect(workspaces.assertAccess(ada.id, 'no-such-workspace')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('getForUser returns null for non-members instead of throwing', async () => {
    const { auth, workspaces } = build()
    const ada = await registerUser(auth, 'ada@example.com')
    const bob = await registerUser(auth, 'bob@example.com')
    const bobsTeam = await workspaces.createTeamWorkspace(bob, {
      name: 'Bobs Team',
      slug: 'bobs-team',
    })

    expect(await workspaces.getForUser(ada.id, bobsTeam.id)).toBeNull()
  })
})
