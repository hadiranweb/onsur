import { randomUUID } from 'node:crypto'
import {
  bumpPatch,
  canProcessTransition,
  nextProcessState,
  validateProcessSteps,
} from '@element-plus/domain'
import type { Process, ProcessStep, Reference } from '@element-plus/contracts'
import { AppError } from '../errors'
import type { ProcessRepository } from '../ports'
import { makeProvenance } from '../util/provenance'

export interface CreateProcessInput {
  title: string
  description: string
  steps: ProcessStep[]
  actorUserId: string
  derivedFrom?: Reference[]
  id?: string
}

export interface ProcessServiceDeps {
  processes: ProcessRepository
  now?: () => Date
}

export class ProcessService {
  private readonly now: () => Date

  constructor(private readonly deps: ProcessServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /** Create a structurally-valid draft Process. */
  async createDraft(input: CreateProcessInput): Promise<Process> {
    const title = input.title.trim()
    const description = input.description.trim()
    if (!title || !description) {
      throw new AppError('INVALID_INPUT', 'process title and description are required')
    }

    const errors = validateProcessSteps(input.steps)
    if (errors.length > 0) {
      throw new AppError('INVALID_INPUT', `invalid process: ${errors.join('; ')}`)
    }

    return this.deps.processes.create({
      id: input.id ?? randomUUID(),
      version: '1.0.0',
      status: 'draft',
      title,
      description,
      steps: input.steps,
      provenance: makeProvenance({
        actorUserId: input.actorUserId,
        derivedFrom: input.derivedFrom,
        reason: `created draft process "${title}"`,
        createdAt: this.now().toISOString(),
      }),
    })
  }

  /** Validate a draft Process (draft → validated). */
  async validate(id: string): Promise<Process> {
    const process = await this.mustFind(id)
    if (!canProcessTransition(process.status, 'validate')) {
      throw new AppError('CONFLICT', `process cannot validate from status ${process.status}`)
    }
    await this.deps.processes.updateStatus(id, nextProcessState(process.status, 'validate'))
    return this.mustFind(id)
  }

  /** Publish a Process (draft | validated → published). */
  async publish(id: string): Promise<Process> {
    const process = await this.mustFind(id)
    if (!canProcessTransition(process.status, 'publish')) {
      throw new AppError('CONFLICT', `process cannot publish from status ${process.status}`)
    }
    await this.deps.processes.updateStatus(id, nextProcessState(process.status, 'publish'))
    return this.mustFind(id)
  }

  /** Publish a newer version; the prior version is preserved (never mutated). */
  async newVersion(
    id: string,
    changes: { title?: string; description?: string; steps?: ProcessStep[] },
    actorUserId: string,
  ): Promise<Process> {
    const latest = await this.mustFind(id)
    const next = {
      title: changes.title !== undefined ? changes.title.trim() : latest.title,
      description:
        changes.description !== undefined ? changes.description.trim() : latest.description,
      steps: changes.steps ?? latest.steps,
    }
    if (!next.title || !next.description) {
      throw new AppError('INVALID_INPUT', 'process title and description must not be empty')
    }
    const errors = validateProcessSteps(next.steps)
    if (errors.length > 0) {
      throw new AppError('INVALID_INPUT', `invalid process: ${errors.join('; ')}`)
    }

    return this.deps.processes.create({
      id: latest.id,
      version: bumpPatch(latest.version),
      status: 'draft',
      title: next.title,
      description: next.description,
      steps: next.steps,
      provenance: makeProvenance({
        actorUserId,
        derivedFrom: [{ id: latest.id, kind: 'process' }],
        reason: `created process version ${bumpPatch(latest.version)} from ${latest.version}`,
        createdAt: this.now().toISOString(),
      }),
    })
  }

  async get(id: string): Promise<Process> {
    return this.mustFind(id)
  }

  async getVersion(id: string, version: string): Promise<Process | null> {
    const versions = await this.deps.processes.listByIdentity(id)
    return versions.find((process) => process.version === version) ?? null
  }

  async list(): Promise<Process[]> {
    return this.deps.processes.list()
  }

  private async mustFind(id: string): Promise<Process> {
    const process = await this.deps.processes.findLatestById(id)
    if (!process) {
      throw new AppError('NOT_FOUND', `process ${id} not found`)
    }
    return process
  }
}
