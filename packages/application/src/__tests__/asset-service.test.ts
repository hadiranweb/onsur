import { describe, expect, it } from 'vitest'
import { AuthService } from '../services/auth-service'
import { AssetService } from '../services/asset-service'
import { WorkspaceService } from '../services/workspace-service'
import {
  FakePasswordHasher,
  FakeSessionCodec,
  InMemoryAssetInstallRepository,
  InMemoryAssetRepository,
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
  const assetsRepo = new InMemoryAssetRepository()
  const installs = new InMemoryAssetInstallRepository()
  const assets = new AssetService({ assets: assetsRepo, installs, workspaces })
  return { auth, workspaces, assets, assetsRepo, installs }
}

async function register(auth: AuthService, email: string) {
  const result = await auth.register({
    email,
    password: 'password123',
    displayName: email.split('@')[0] ?? 'u',
  })
  return result.user
}

const contentRef = { id: 'isl-1', kind: 'island' as const }

describe('asset registry', () => {
  it('registers a private asset and honors the publication gate', async () => {
    const { auth, assets } = build()
    const user = await register(auth, 'alice@example.com')

    const asset = await assets.register({
      kind: 'island',
      name: 'My Island',
      description: 'a reusable island',
      license: 'MIT',
      contentRef,
      actorUserId: user.id,
    })
    expect(asset.version).toBe('1.0.0')
    expect(asset.visibility).toBe('private')
    expect(asset.owner.id).toBe(user.id)
    expect(asset.provenance.derivedFrom).toContainEqual(contentRef)
  })

  it('rejects registering a public dataset without rights metadata', async () => {
    const { auth, assets } = build()
    const user = await register(auth, 'alice@example.com')
    await expect(
      assets.register({
        kind: 'dataset',
        name: 'Secret Data',
        description: 'data',
        license: 'MIT',
        contentRef,
        visibility: 'public',
        actorUserId: user.id,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('publishes an asset, gated and owner-only', async () => {
    const { auth, assets } = build()
    const alice = await register(auth, 'alice@example.com')
    const bob = await register(auth, 'bob@example.com')

    const asset = await assets.register({
      kind: 'island',
      name: 'My Island',
      description: 'reusable',
      license: 'MIT',
      contentRef,
      actorUserId: alice.id,
    })

    await expect(assets.publish(asset.id, bob.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect((await assets.publish(asset.id, alice.id)).visibility).toBe('public')
  })

  it('rejects publishing a dataset publicly without rights metadata', async () => {
    const { auth, assets } = build()
    const user = await register(auth, 'alice@example.com')
    const dataset = await assets.register({
      kind: 'dataset',
      name: 'Data',
      description: 'data',
      license: 'MIT',
      contentRef,
      actorUserId: user.id,
    })
    await expect(assets.publish(dataset.id, user.id)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })
})

describe('asset versioning', () => {
  it('newVersion preserves the prior version', async () => {
    const { auth, assets, assetsRepo } = build()
    const user = await register(auth, 'alice@example.com')
    const asset = await assets.register({
      kind: 'island',
      name: 'My Island',
      description: 'v1',
      license: 'MIT',
      contentRef,
      actorUserId: user.id,
    })
    const next = await assets.newVersion(asset.id, { description: 'v2' }, user.id)
    expect(next.version).toBe('1.0.1')
    const versions = assetsRepo.all().filter((entry) => entry.id === asset.id)
    expect(versions.map((entry) => entry.version).sort()).toEqual(['1.0.0', '1.0.1'])
  })
})

describe('asset install', () => {
  it('installs an exact version and is idempotent per workspace', async () => {
    const { auth, workspaces, assets, installs } = build()
    const alice = await register(auth, 'alice@example.com')
    const personal = (await workspaces.getPersonalWorkspace(alice.id))!
    const asset = await assets.register({
      kind: 'island',
      name: 'My Island',
      description: 'reusable',
      license: 'MIT',
      contentRef,
      actorUserId: alice.id,
    })

    const first = await assets.install(asset.id, '1.0.0', personal.id, alice.id)
    const second = await assets.install(asset.id, '1.0.0', personal.id, alice.id)
    expect(first.id).toBe(second.id)
    expect(installs.all()).toHaveLength(1)
  })

  it('rejects installing a non-exact version', async () => {
    const { auth, workspaces, assets } = build()
    const alice = await register(auth, 'alice@example.com')
    const personal = (await workspaces.getPersonalWorkspace(alice.id))!
    const asset = await assets.register({
      kind: 'island',
      name: 'My Island',
      description: 'reusable',
      license: 'MIT',
      contentRef,
      actorUserId: alice.id,
    })
    await expect(assets.install(asset.id, 'latest', personal.id, alice.id)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })

  it('rejects cross-workspace install of a private asset', async () => {
    const { auth, workspaces, assets } = build()
    const alice = await register(auth, 'alice@example.com')
    const bob = await register(auth, 'bob@example.com')
    const bobPersonal = (await workspaces.getPersonalWorkspace(bob.id))!
    const asset = await assets.register({
      kind: 'island',
      name: 'Private',
      description: 'private',
      license: 'MIT',
      contentRef,
      actorUserId: alice.id,
    })
    await expect(assets.install(asset.id, '1.0.0', bobPersonal.id, bob.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})

describe('asset fork', () => {
  it('forks a public asset with derivative provenance', async () => {
    const { auth, assets } = build()
    const alice = await register(auth, 'alice@example.com')
    const bob = await register(auth, 'bob@example.com')

    const asset = await assets.register({
      kind: 'island',
      name: 'Public Island',
      description: 'reusable',
      license: 'MIT',
      contentRef,
      actorUserId: alice.id,
    })
    await assets.publish(asset.id, alice.id)

    const fork = await assets.fork(asset.id, bob.id)
    expect(fork.asset.id).not.toBe(asset.id)
    expect(fork.asset.owner.id).toBe(bob.id)
    expect(fork.asset.provenance.derivedFrom).toContainEqual({ id: asset.id, kind: 'asset' })
  })

  it('cannot fork a private asset owned by someone else', async () => {
    const { auth, assets } = build()
    const alice = await register(auth, 'alice@example.com')
    const bob = await register(auth, 'bob@example.com')
    const asset = await assets.register({
      kind: 'island',
      name: 'Private',
      description: 'private',
      license: 'MIT',
      contentRef,
      actorUserId: alice.id,
    })
    await expect(assets.fork(asset.id, bob.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('catalog search', () => {
  it('searches public assets by name, tag, kind, and description', async () => {
    const { auth, assets } = build()
    const user = await register(auth, 'alice@example.com')
    const a = await assets.register({
      kind: 'island',
      name: 'Email Sender Island',
      description: 'sends email',
      tags: ['email'],
      license: 'MIT',
      contentRef,
      actorUserId: user.id,
    })
    await assets.publish(a.id, user.id)

    expect((await assets.search('email')).map((asset) => asset.id)).toContain(a.id)
    expect((await assets.search('island')).map((asset) => asset.id)).toContain(a.id)
    expect((await assets.search('zzz')).map((asset) => asset.id)).not.toContain(a.id)
  })

  it('lists owned and installed assets for My Assets', async () => {
    const { auth, workspaces, assets } = build()
    const user = await register(auth, 'alice@example.com')
    const personal = (await workspaces.getPersonalWorkspace(user.id))!
    const asset = await assets.register({
      kind: 'island',
      name: 'Mine',
      description: 'owned',
      license: 'MIT',
      contentRef,
      actorUserId: user.id,
    })
    await assets.install(asset.id, '1.0.0', personal.id, user.id)

    const mine = await assets.listMyAssets(user)
    expect(mine.owned.map((entry) => entry.id)).toContain(asset.id)
    expect(mine.installed).toHaveLength(1)
    expect(mine.installed[0]!.install.assetId).toBe(asset.id)
  })
})
