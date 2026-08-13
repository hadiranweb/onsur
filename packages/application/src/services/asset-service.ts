import { randomUUID } from 'node:crypto'
import { bumpPatch, canPublishAsset, installsExactVersion } from '@element-plus/domain'
import type { AssetKind, Reference } from '@element-plus/contracts'
import { AppError } from '../errors'
import type {
  AssetInstallRecord,
  AssetInstallRepository,
  AssetRecord,
  AssetRepository,
  UserRecord,
} from '../ports'
import { makeProvenance } from '../util/provenance'
import type { WorkspaceService } from './workspace-service'

export interface RegisterAssetInput {
  kind: AssetKind
  name: string
  description: string
  tags?: string[]
  license: string
  contentRef: Reference
  rights?: Record<string, string>
  visibility?: 'private' | 'workspace' | 'public'
  actorUserId: string
  workspaceId?: string
}

export interface AssetServiceDeps {
  assets: AssetRepository
  installs: AssetInstallRepository
  workspaces: WorkspaceService
  now?: () => Date
}

export interface ForkResult {
  asset: AssetRecord
  forked: true
}

export class AssetService {
  private readonly now: () => Date

  constructor(private readonly deps: AssetServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /** Register a new asset (version 1.0.0). Publication gate applies. */
  async register(input: RegisterAssetInput): Promise<AssetRecord> {
    const name = input.name.trim()
    const description = input.description.trim()
    if (!name || !description) {
      throw new AppError('INVALID_INPUT', 'asset name and description are required')
    }

    const record: Omit<AssetRecord, 'createdAt'> = {
      id: randomUUID(),
      version: '1.0.0',
      kind: input.kind,
      name,
      description,
      tags: input.tags ?? [],
      owner: { id: input.actorUserId, kind: 'user' },
      visibility: input.visibility ?? 'private',
      license: input.license.trim(),
      contentRef: input.contentRef,
      rights: input.rights,
      provenance: makeProvenance({
        actorUserId: input.actorUserId,
        derivedFrom: [input.contentRef],
        reason: `registered asset "${name}"`,
        createdAt: this.now().toISOString(),
      }),
    }

    const gate = canPublishAsset(record)
    if (record.visibility === 'public' && !gate.allowed) {
      throw new AppError('INVALID_INPUT', `publication gate failed: ${gate.issues.join('; ')}`)
    }

    return this.deps.assets.create(record)
  }

  /** Publish an asset (private/workspace → public), gated. */
  async publish(id: string, actorUserId: string): Promise<AssetRecord> {
    const asset = await this.mustFind(id)
    if (asset.owner.id !== actorUserId) {
      throw new AppError('FORBIDDEN', 'only the asset owner may publish')
    }
    const gate = canPublishAsset(asset)
    if (!gate.allowed) {
      throw new AppError('INVALID_INPUT', `publication gate failed: ${gate.issues.join('; ')}`)
    }
    if (asset.visibility === 'public') {
      return asset
    }
    await this.deps.assets.updateVisibility(id, asset.version, 'public')
    return this.mustFind(id)
  }

  /** Create a new asset version; the prior version is preserved. */
  async newVersion(
    id: string,
    changes: { name?: string; description?: string; tags?: string[]; contentRef?: Reference },
    actorUserId: string,
  ): Promise<AssetRecord> {
    const latest = await this.mustFind(id)
    const record: Omit<AssetRecord, 'createdAt'> = {
      id: latest.id,
      version: bumpPatch(latest.version),
      kind: latest.kind,
      name: changes.name?.trim() ?? latest.name,
      description: changes.description?.trim() ?? latest.description,
      tags: changes.tags ?? latest.tags,
      owner: latest.owner,
      visibility: 'private',
      license: latest.license,
      contentRef: changes.contentRef ?? latest.contentRef,
      rights: latest.rights,
      provenance: makeProvenance({
        actorUserId,
        derivedFrom: [{ id: latest.id, kind: 'asset' }],
        reason: `created asset version ${bumpPatch(latest.version)} from ${latest.version}`,
        createdAt: this.now().toISOString(),
      }),
    }
    return this.deps.assets.create(record)
  }

  /** Fork an asset into a new identity with derivative provenance. */
  async fork(id: string, actorUserId: string): Promise<ForkResult> {
    const source = await this.mustFind(id)
    if (source.visibility !== 'public' && source.owner.id !== actorUserId) {
      throw new AppError('FORBIDDEN', 'only public assets may be forked by others')
    }
    const record: Omit<AssetRecord, 'createdAt'> = {
      id: randomUUID(),
      version: '1.0.0',
      kind: source.kind,
      name: `${source.name} (fork)`,
      description: source.description,
      tags: source.tags,
      owner: { id: actorUserId, kind: 'user' },
      visibility: 'private',
      license: source.license,
      contentRef: source.contentRef,
      rights: source.rights,
      provenance: makeProvenance({
        actorUserId,
        derivedFrom: [{ id: source.id, kind: 'asset' }],
        reason: `forked asset ${source.id}@${source.version}`,
        createdAt: this.now().toISOString(),
      }),
    }
    const asset = await this.deps.assets.create(record)
    return { asset, forked: true }
  }

  /** Install an exact asset version into a workspace. */
  async install(
    id: string,
    version: string,
    workspaceId: string,
    actorUserId: string,
  ): Promise<AssetInstallRecord> {
    await this.deps.workspaces.assertAccess(actorUserId, workspaceId)
    if (!installsExactVersion(version)) {
      throw new AppError('INVALID_INPUT', 'install requires an exact semver version')
    }
    const asset = await this.deps.assets.findVersion(id, version)
    if (!asset) {
      throw new AppError('NOT_FOUND', `asset ${id}@${version} not found`)
    }
    if (asset.visibility === 'private' && asset.owner.id !== actorUserId) {
      throw new AppError('FORBIDDEN', 'private assets cannot be installed by others')
    }

    const existing = await this.deps.installs.findByAssetVersion(id, version, workspaceId)
    if (existing) {
      return existing
    }

    return this.deps.installs.create({
      id: randomUUID(),
      assetId: id,
      version,
      workspaceId,
      installedBy: actorUserId,
      provenance: makeProvenance({
        actorUserId,
        derivedFrom: [{ id, kind: 'asset' }],
        reason: `installed asset ${id}@${version}`,
        createdAt: this.now().toISOString(),
      }),
    })
  }

  /** Install the latest version of an asset. */
  async installLatest(
    id: string,
    workspaceId: string,
    actorUserId: string,
  ): Promise<AssetInstallRecord> {
    const asset = await this.mustFind(id)
    return this.install(id, asset.version, workspaceId, actorUserId)
  }

  async get(id: string): Promise<AssetRecord> {
    return this.mustFind(id)
  }

  async getVersion(id: string, version: string): Promise<AssetRecord | null> {
    return this.deps.assets.findVersion(id, version)
  }

  /** Public catalog (marketplace). */
  async listPublic(): Promise<AssetRecord[]> {
    return this.deps.assets.listPublic()
  }

  /** Assets the user owns or has installed (My Assets). */
  async listMyAssets(user: UserRecord): Promise<{
    owned: AssetRecord[]
    installed: { install: AssetInstallRecord; asset: AssetRecord | null }[]
  }> {
    const owned = await this.deps.assets.listByOwner(user.id)
    const accesses = await this.deps.workspaces.listForUser(user.id)
    const installed: { install: AssetInstallRecord; asset: AssetRecord | null }[] = []
    for (const access of accesses) {
      const workspaceInstalls = await this.deps.installs.listByWorkspace(access.workspace.id)
      for (const install of workspaceInstalls) {
        const asset = await this.deps.assets.findVersion(install.assetId, install.version)
        installed.push({ install, asset })
      }
    }
    return { owned, installed }
  }

  /** Catalog search by name/tags/kind over public assets. */
  async search(query: string): Promise<AssetRecord[]> {
    const q = query.trim().toLowerCase()
    const all = await this.deps.assets.listPublic()
    if (!q) {
      return all
    }
    return all.filter(
      (asset) =>
        asset.name.toLowerCase().includes(q) ||
        asset.description.toLowerCase().includes(q) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        asset.kind.toLowerCase().includes(q),
    )
  }

  async listVersions(id: string): Promise<AssetRecord[]> {
    return this.deps.assets.listByIdentity(id)
  }

  private async mustFind(id: string): Promise<AssetRecord> {
    const asset = await this.deps.assets.findLatestById(id)
    if (!asset) {
      throw new AppError('NOT_FOUND', `asset ${id} not found`)
    }
    return asset
  }
}
