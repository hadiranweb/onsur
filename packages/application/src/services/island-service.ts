import { randomUUID } from 'node:crypto'
import {
  bumpPatch,
  canActivateIsland,
  canIslandTransition,
  nextIslandState,
  resolveIsland,
} from '@element-plus/domain'
import { islandManifestSchema } from '@element-plus/contracts'
import type { Island, IslandManifest, Reference } from '@element-plus/contracts'
import { AppError } from '../errors'
import type { IslandRepository } from '../ports'
import { makeProvenance } from '../util/provenance'
import type { CapabilityService } from './capability-service'
import {
  STRUCTURED_ANALYSIS_CAPABILITY,
  structuredAnalysisIslandManifest,
} from '../reference-islands/structured-analysis'
import {
  CONTROLLED_ACTION_CAPABILITY,
  controlledActionIslandManifest,
} from '../reference-islands/controlled-action'

export interface CreateIslandInput {
  manifest: IslandManifest
  actorUserId: string
  derivedFrom?: Reference[]
  id?: string
}

export interface IslandServiceDeps {
  islands: IslandRepository
  capabilities: CapabilityService
  now?: () => Date
}

export interface ResolveOrCreateResult {
  island: Island
  reused: boolean
}

export class IslandService {
  private readonly now: () => Date

  constructor(private readonly deps: IslandServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /** Create a draft Island from a validated manifest. */
  async createDraft(input: CreateIslandInput): Promise<Island> {
    const parsed = islandManifestSchema.safeParse(input.manifest)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'invalid island manifest')
    }
    const manifest = parsed.data

    return this.deps.islands.create({
      id: input.id ?? randomUUID(),
      version: '1.0.0',
      status: 'draft',
      name: manifest.name,
      description: manifest.description,
      capabilities: manifest.capabilities,
      runtime: manifest.runtime,
      permissions: manifest.permissions,
      provenance: makeProvenance({
        actorUserId: input.actorUserId,
        derivedFrom: input.derivedFrom,
        reason: `created draft island "${manifest.name}"`,
        createdAt: this.now().toISOString(),
      }),
    })
  }

  /** Propose a draft Island (draft → candidate). */
  async propose(id: string): Promise<Island> {
    return this.transition(id, 'propose')
  }

  /**
   * Activate an Island. Activation requires a well-formed manifest bound to a
   * concrete runtime; invalid Islands cannot activate.
   */
  async activate(id: string): Promise<Island> {
    const island = await this.mustFind(id)
    if (!canActivateIsland(island)) {
      throw new AppError(
        'INVALID_INPUT',
        `island "${island.name}" cannot activate: unbound runtime or invalid manifest`,
      )
    }
    return this.transition(id, 'activate')
  }

  /** Retire an Island (candidate | active | draft → retired). */
  async retire(id: string): Promise<Island> {
    return this.transition(id, 'retire')
  }

  /** Create the next draft version; the prior version is preserved. */
  async newVersion(
    id: string,
    changes: Partial<IslandManifest>,
    actorUserId: string,
  ): Promise<Island> {
    const latest = await this.mustFind(id)
    const merged: IslandManifest = {
      name: changes.name ?? latest.name,
      description: changes.description ?? latest.description,
      capabilities: changes.capabilities ?? latest.capabilities,
      runtime: changes.runtime ?? latest.runtime,
      permissions: changes.permissions ?? latest.permissions,
    }
    const parsed = islandManifestSchema.safeParse(merged)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'invalid island manifest')
    }
    const manifest = parsed.data

    return this.deps.islands.create({
      id: latest.id,
      version: bumpPatch(latest.version),
      status: 'draft',
      name: manifest.name,
      description: manifest.description,
      capabilities: manifest.capabilities,
      runtime: manifest.runtime,
      permissions: manifest.permissions,
      provenance: makeProvenance({
        actorUserId,
        derivedFrom: [{ id: latest.id, kind: 'island' }],
        reason: `created island version ${bumpPatch(latest.version)} from ${latest.version}`,
        createdAt: this.now().toISOString(),
      }),
    })
  }

  /** Find the best compatible active Island for a set of required capabilities. */
  async resolve(
    requiredCapabilityIds: readonly string[],
  ): Promise<{ island: Island; score: number } | null> {
    const active = await this.deps.islands.listActive()
    return resolveIsland(active, requiredCapabilityIds)
  }

  /**
   * Reuse before creation: return a compatible active Island when one exists,
   * otherwise create a new draft Island.
   */
  async resolveOrCreate(input: {
    manifest: IslandManifest
    requiredCapabilityIds: readonly string[]
    actorUserId: string
    derivedFrom?: Reference[]
  }): Promise<ResolveOrCreateResult> {
    const existing = await this.resolve(input.requiredCapabilityIds)
    if (existing) {
      return { island: existing.island, reused: true }
    }
    const island = await this.createDraft({
      manifest: input.manifest,
      actorUserId: input.actorUserId,
      derivedFrom: input.derivedFrom,
    })
    return { island, reused: false }
  }

  /**
   * Ensure the reference Structured Analysis Island exists (registering its
   * capability if needed) and is active. Reuses an existing active island.
   */
  async ensureReferenceIsland(input: {
    actorUserId: string
    derivedFrom?: Reference[]
  }): Promise<ResolveOrCreateResult> {
    await this.deps.capabilities.ensureByName({
      id: STRUCTURED_ANALYSIS_CAPABILITY.id,
      name: STRUCTURED_ANALYSIS_CAPABILITY.name,
      description: STRUCTURED_ANALYSIS_CAPABILITY.description,
      tags: STRUCTURED_ANALYSIS_CAPABILITY.tags,
      actorUserId: input.actorUserId,
    })

    const required = structuredAnalysisIslandManifest.capabilities.map(
      (capability) => capability.id,
    )
    const existing = await this.resolve(required)
    if (existing) {
      return { island: existing.island, reused: true }
    }

    const draft = await this.createDraft({
      manifest: structuredAnalysisIslandManifest,
      actorUserId: input.actorUserId,
      derivedFrom: input.derivedFrom,
    })
    await this.propose(draft.id)
    const active = await this.activate(draft.id)
    return { island: active, reused: false }
  }

  /**
   * Ensure the reference Controlled Action Island exists and is active.
   * Reuses an existing compatible active island.
   */
  async ensureControlledActionIsland(input: {
    actorUserId: string
    derivedFrom?: Reference[]
  }): Promise<ResolveOrCreateResult> {
    await this.deps.capabilities.ensureByName({
      id: CONTROLLED_ACTION_CAPABILITY.id,
      name: CONTROLLED_ACTION_CAPABILITY.name,
      description: CONTROLLED_ACTION_CAPABILITY.description,
      tags: CONTROLLED_ACTION_CAPABILITY.tags,
      actorUserId: input.actorUserId,
    })

    const required = controlledActionIslandManifest.capabilities.map((capability) => capability.id)
    const existing = await this.resolve(required)
    if (existing) {
      return { island: existing.island, reused: true }
    }

    const draft = await this.createDraft({
      manifest: controlledActionIslandManifest,
      actorUserId: input.actorUserId,
      derivedFrom: input.derivedFrom,
    })
    await this.propose(draft.id)
    const active = await this.activate(draft.id)
    return { island: active, reused: false }
  }

  async get(id: string): Promise<Island> {
    return this.mustFind(id)
  }

  async list(): Promise<Island[]> {
    return this.deps.islands.list()
  }

  async listActive(): Promise<Island[]> {
    return this.deps.islands.listActive()
  }

  private async transition(
    id: string,
    event: 'propose' | 'activate' | 'retire' | 'reject',
  ): Promise<Island> {
    const island = await this.mustFind(id)
    if (!canIslandTransition(island.status, event)) {
      throw new AppError('CONFLICT', `island cannot ${event} from status ${island.status}`)
    }
    await this.deps.islands.updateStatus(id, nextIslandState(island.status, event))
    return this.mustFind(id)
  }

  private async mustFind(id: string): Promise<Island> {
    const island = await this.deps.islands.findLatestById(id)
    if (!island) {
      throw new AppError('NOT_FOUND', `island ${id} not found`)
    }
    return island
  }
}
