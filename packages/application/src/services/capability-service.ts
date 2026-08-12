import { randomUUID } from 'node:crypto'
import type { Capability, Reference } from '@element-plus/contracts'
import { AppError } from '../errors'
import type { CapabilityRepository } from '../ports'
import { makeProvenance } from '../util/provenance'

export interface RegisterCapabilityInput {
  name: string
  description: string
  tags?: string[]
  actorUserId: string
  derivedFrom?: Reference[]
  id?: string
}

export interface CapabilityServiceDeps {
  capabilities: CapabilityRepository
  now?: () => Date
}

export class CapabilityService {
  private readonly now: () => Date

  constructor(private readonly deps: CapabilityServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /** Register a new capability (unique by name). */
  async register(input: RegisterCapabilityInput): Promise<Capability> {
    const name = input.name.trim()
    const description = input.description.trim()
    if (!name || !description) {
      throw new AppError('INVALID_INPUT', 'capability name and description are required')
    }

    const existing = await this.deps.capabilities.findLatestByName(name)
    if (existing) {
      throw new AppError('CONFLICT', `capability "${name}" is already registered`)
    }

    return this.deps.capabilities.create({
      id: input.id ?? randomUUID(),
      version: '1.0.0',
      name,
      description,
      tags: input.tags ?? [],
      provenance: makeProvenance({
        actorUserId: input.actorUserId,
        derivedFrom: input.derivedFrom,
        reason: `registered capability "${name}"`,
        createdAt: this.now().toISOString(),
      }),
    })
  }

  /** Register the capability if absent; return it either way. */
  async ensureByName(
    input: RegisterCapabilityInput,
  ): Promise<{ capability: Capability; created: boolean }> {
    const existing = await this.deps.capabilities.findLatestByName(input.name.trim())
    if (existing) {
      return { capability: existing, created: false }
    }
    return { capability: await this.register(input), created: true }
  }

  async get(id: string): Promise<Capability> {
    const capability = await this.deps.capabilities.findLatestById(id)
    if (!capability) {
      throw new AppError('NOT_FOUND', `capability ${id} not found`)
    }
    return capability
  }

  async findByName(name: string): Promise<Capability | null> {
    return this.deps.capabilities.findLatestByName(name.trim())
  }

  async list(): Promise<Capability[]> {
    return this.deps.capabilities.list()
  }
}
