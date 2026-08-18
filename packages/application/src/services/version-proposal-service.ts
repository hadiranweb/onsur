import { randomUUID } from 'node:crypto'
import {
  canMergeProposal,
  canProposalTransition,
  isForwardProposal,
  isNextPatch,
  nextProposalState,
} from '@element-plus/domain'
import type { Reference, VersionProposalEvent } from '@element-plus/contracts'
import { AppError } from '../errors'
import type { VersionProposalRecord, VersionProposalRepository } from '../ports'
import { makeProvenance } from '../util/provenance'
import type { IslandService } from './island-service'
import type { KnowledgeService } from './knowledge-service'
import type { ProcessService } from './process-service'

export interface ProposeVersionInput {
  target: Reference
  fromVersion: string
  toVersion: string
  rationale: string
  content?: string
  evidenceRefs?: Reference[]
  actorUserId: string
}

export interface VersionProposalServiceDeps {
  proposals: VersionProposalRepository
  knowledge: KnowledgeService
  processes: ProcessService
  islands: IslandService
  now?: () => Date
}

export class VersionProposalService {
  private readonly now: () => Date

  constructor(private readonly deps: VersionProposalServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /** Propose a forward version change (status `proposed`). */
  async propose(input: ProposeVersionInput): Promise<VersionProposalRecord> {
    const rationale = input.rationale.trim()
    if (rationale.length === 0) {
      throw new AppError('INVALID_INPUT', 'rationale must not be empty')
    }
    const proposal: VersionProposalRecord = {
      id: randomUUID(),
      target: input.target,
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      rationale,
      content: input.content,
      evidenceRefs: input.evidenceRefs ?? [],
      status: 'proposed',
      provenance: makeProvenance({
        actorUserId: input.actorUserId,
        derivedFrom: input.evidenceRefs ?? [],
        reason: `proposed version change ${input.fromVersion} → ${input.toVersion}`,
        createdAt: this.now().toISOString(),
      }),
      createdAt: this.now().toISOString(),
    }
    if (!isForwardProposal(proposal)) {
      throw new AppError(
        'INVALID_INPUT',
        `proposal must be forward (${input.toVersion} is not > ${input.fromVersion})`,
      )
    }
    return this.deps.proposals.create(proposal)
  }

  async review(id: string): Promise<VersionProposalRecord> {
    return this.transition(id, 'review')
  }

  async approve(id: string): Promise<VersionProposalRecord> {
    return this.transition(id, 'approve')
  }

  async reject(id: string): Promise<VersionProposalRecord> {
    return this.transition(id, 'reject')
  }

  /**
   * Merge an approved proposal: produces the new version of the target while
   * preserving the old version and provenance. No automatic canonical merge
   * without this explicit, authorized step.
   */
  async merge(id: string, actorUserId: string): Promise<VersionProposalRecord> {
    const proposal = await this.mustFind(id)
    if (!canMergeProposal(proposal)) {
      throw new AppError(
        'CONFLICT',
        `proposal cannot merge from status ${proposal.status} (must be approved and forward)`,
      )
    }

    if (proposal.target.kind === 'knowledge') {
      const content = proposal.content?.trim()
      if (!content) {
        throw new AppError('INVALID_INPUT', 'knowledge proposals require proposed content')
      }
      await this.deps.knowledge.mergeProposal(
        proposal.target.id,
        proposal.fromVersion,
        proposal.toVersion,
        content,
        actorUserId,
      )
    } else if (proposal.target.kind === 'process') {
      if (!isNextPatch(proposal.fromVersion, proposal.toVersion)) {
        throw new AppError(
          'INVALID_INPUT',
          'process proposals must advance exactly one patch version',
        )
      }
      await this.deps.processes.newVersion(proposal.target.id, {}, actorUserId)
    } else if (proposal.target.kind === 'island') {
      if (!isNextPatch(proposal.fromVersion, proposal.toVersion)) {
        throw new AppError(
          'INVALID_INPUT',
          'island proposals must advance exactly one patch version',
        )
      }
      await this.deps.islands.newVersion(proposal.target.id, {}, actorUserId)
    } else {
      throw new AppError(
        'INVALID_INPUT',
        `unsupported proposal target kind "${proposal.target.kind}"`,
      )
    }

    return this.transition(id, 'merge')
  }

  async get(id: string): Promise<VersionProposalRecord> {
    return this.mustFind(id)
  }

  async list(): Promise<VersionProposalRecord[]> {
    return this.deps.proposals.list()
  }

  async listByTarget(targetId: string): Promise<VersionProposalRecord[]> {
    return this.deps.proposals.listByTarget(targetId)
  }

  private async transition(
    id: string,
    event: VersionProposalEvent,
  ): Promise<VersionProposalRecord> {
    const proposal = await this.mustFind(id)
    if (!canProposalTransition(proposal.status, event)) {
      throw new AppError('CONFLICT', `proposal cannot ${event} from status ${proposal.status}`)
    }
    await this.deps.proposals.updateStatus(id, nextProposalState(proposal.status, event))
    return this.mustFind(id)
  }

  private async mustFind(id: string): Promise<VersionProposalRecord> {
    const proposal = await this.deps.proposals.findById(id)
    if (!proposal) {
      throw new AppError('NOT_FOUND', `version proposal ${id} not found`)
    }
    return proposal
  }
}
