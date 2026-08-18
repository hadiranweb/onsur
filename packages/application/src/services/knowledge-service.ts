import { randomUUID } from 'node:crypto'
import {
  bumpPatch,
  canKnowledgeTransition,
  nextKnowledgeState,
  validateKnowledge,
} from '@element-plus/domain'
import type { KnowledgeEvent, Reference } from '@element-plus/contracts'
import { AppError } from '../errors'
import type { KnowledgeRecord, KnowledgeRepository } from '../ports'
import { makeProvenance } from '../util/provenance'

export interface CreateKnowledgeInput {
  workspaceId: string
  ownerId: string
  title: string
  content: string
  evidenceRefs?: Reference[]
  actorUserId: string
  id?: string
}

export interface KnowledgeServiceDeps {
  knowledge: KnowledgeRepository
  now?: () => Date
}

export class KnowledgeService {
  private readonly now: () => Date

  constructor(private readonly deps: KnowledgeServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /** Create a draft knowledge entry, versioned and evidence-backed. */
  async createDraft(input: CreateKnowledgeInput): Promise<KnowledgeRecord> {
    const title = input.title.trim()
    const content = input.content.trim()
    const record = {
      id: input.id ?? randomUUID(),
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      version: '1.0.0',
      status: 'draft' as const,
      title,
      content,
      evidenceRefs: input.evidenceRefs ?? [],
      provenance: makeProvenance({
        actorUserId: input.actorUserId,
        derivedFrom: input.evidenceRefs ?? [],
        reason: `created draft knowledge "${title}"`,
        createdAt: this.now().toISOString(),
      }),
    }
    const errors = validateKnowledge(record)
    if (errors.length > 0) {
      throw new AppError('INVALID_INPUT', errors.join('; '))
    }
    return this.deps.knowledge.create(record)
  }

  /** Publish a draft (draft → published). */
  async publish(id: string): Promise<KnowledgeRecord> {
    const knowledge = await this.mustFind(id)
    return this.transition(id, knowledge.version, 'publish')
  }

  /**
   * Create the next version of a knowledge entry (draft or published source).
   * The prior version is superseded (never mutated), and the new version is
   * returned as a draft for review/publish.
   */
  async newVersion(
    id: string,
    changes: { title?: string; content?: string; evidenceRefs?: Reference[] },
    actorUserId: string,
  ): Promise<KnowledgeRecord> {
    const latest = await this.mustFind(id)
    const next = {
      title: changes.title !== undefined ? changes.title.trim() : latest.title,
      content: changes.content !== undefined ? changes.content.trim() : latest.content,
      evidenceRefs: changes.evidenceRefs ?? latest.evidenceRefs,
    }
    const record = {
      id: latest.id,
      workspaceId: latest.workspaceId,
      ownerId: latest.ownerId,
      version: bumpPatch(latest.version),
      status: 'draft' as const,
      title: next.title,
      content: next.content,
      evidenceRefs: next.evidenceRefs,
      provenance: makeProvenance({
        actorUserId,
        derivedFrom: [{ id: latest.id, kind: 'knowledge' }],
        reason: `created knowledge version ${bumpPatch(latest.version)} from ${latest.version}`,
        createdAt: this.now().toISOString(),
      }),
    }
    const errors = validateKnowledge(record)
    if (errors.length > 0) {
      throw new AppError('INVALID_INPUT', errors.join('; '))
    }
    const created = await this.deps.knowledge.create(record)
    await this.deps.knowledge.updateStatus(latest.id, latest.version, 'superseded')
    return created
  }

  /** Merge an approved proposal's content as a new published version. */
  async mergeProposal(
    id: string,
    fromVersion: string,
    toVersion: string,
    content: string,
    actorUserId: string,
  ): Promise<KnowledgeRecord> {
    const source = await this.deps.knowledge.findVersion(id, fromVersion)
    if (!source) {
      throw new AppError('NOT_FOUND', `knowledge version ${id}@${fromVersion} not found`)
    }
    const record = {
      id: source.id,
      workspaceId: source.workspaceId,
      ownerId: source.ownerId,
      version: toVersion,
      status: 'published' as const,
      title: source.title,
      content: content.trim(),
      evidenceRefs: source.evidenceRefs,
      provenance: makeProvenance({
        actorUserId,
        derivedFrom: [{ id: source.id, kind: 'knowledge' }],
        reason: `merged version ${toVersion} from proposal against ${fromVersion}`,
        createdAt: this.now().toISOString(),
      }),
    }
    const errors = validateKnowledge(record)
    if (errors.length > 0) {
      throw new AppError('INVALID_INPUT', errors.join('; '))
    }
    const created = await this.deps.knowledge.create(record)
    await this.deps.knowledge.updateStatus(source.id, fromVersion, 'superseded')
    return created
  }

  async get(id: string): Promise<KnowledgeRecord> {
    return this.mustFind(id)
  }

  async getVersion(id: string, version: string): Promise<KnowledgeRecord | null> {
    return this.deps.knowledge.findVersion(id, version)
  }

  async list(workspaceId: string): Promise<KnowledgeRecord[]> {
    return this.deps.knowledge.listByWorkspace(workspaceId)
  }

  async listVersions(id: string): Promise<KnowledgeRecord[]> {
    return this.deps.knowledge.listByIdentity(id)
  }

  private async transition(
    id: string,
    version: string,
    event: KnowledgeEvent,
  ): Promise<KnowledgeRecord> {
    const knowledge = await this.deps.knowledge.findVersion(id, version)
    if (!knowledge) {
      throw new AppError('NOT_FOUND', `knowledge ${id}@${version} not found`)
    }
    if (!canKnowledgeTransition(knowledge.status, event)) {
      throw new AppError('CONFLICT', `knowledge cannot ${event} from status ${knowledge.status}`)
    }
    await this.deps.knowledge.updateStatus(id, version, nextKnowledgeState(knowledge.status, event))
    return this.deps.knowledge.findVersion(id, version) as Promise<KnowledgeRecord>
  }

  private async mustFind(id: string): Promise<KnowledgeRecord> {
    const knowledge = await this.deps.knowledge.findLatestById(id)
    if (!knowledge) {
      throw new AppError('NOT_FOUND', `knowledge ${id} not found`)
    }
    return knowledge
  }
}
