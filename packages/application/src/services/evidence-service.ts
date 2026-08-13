import { randomUUID } from 'node:crypto'
import {
  canEvidenceTransition,
  evaluateEvidenceQuality,
  isApproximateDuplicate,
  nextEvidenceState,
} from '@element-plus/domain'
import type { Evidence, EvidenceEvent, Reference } from '@element-plus/contracts'
import { AppError } from '../errors'
import type { EvidenceRecord, EvidenceRepository } from '../ports'
import { fingerprintContent } from '../util/fingerprint'
import { makeProvenance } from '../util/provenance'

export interface IntakeEvidenceInput {
  workspaceId: string
  kind: Evidence['kind']
  content: string
  actorUserId: string
  source?: Reference
}

export interface EvidenceServiceDeps {
  evidence: EvidenceRepository
  now?: () => Date
}

export class EvidenceService {
  private readonly now: () => Date

  constructor(private readonly deps: EvidenceServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /** Intake raw evidence (status `intake`). Fingerprint is computed here. */
  async intake(input: IntakeEvidenceInput): Promise<EvidenceRecord> {
    const content = input.content.trim()
    if (content.length === 0) {
      throw new AppError('INVALID_INPUT', 'evidence content must not be empty')
    }
    return this.deps.evidence.create({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      kind: input.kind,
      content,
      fingerprint: fingerprintContent(content),
      status: 'intake',
      source: input.source,
      provenance: makeProvenance({
        actorUserId: input.actorUserId,
        reason: 'evidence intake',
        createdAt: this.now().toISOString(),
      }),
    })
  }

  /** Submit for review: only evidence passing the quality gate may proceed. */
  async submit(id: string): Promise<EvidenceRecord> {
    const evidence = await this.mustFind(id)
    const report = evaluateEvidenceQuality(evidence)
    if (!report.passed) {
      throw new AppError(
        'INVALID_INPUT',
        `evidence failed the quality gate: ${report.issues.join('; ')}`,
      )
    }
    return this.transition(id, 'submit')
  }

  async accept(id: string): Promise<EvidenceRecord> {
    return this.transition(id, 'accept')
  }

  async reject(id: string): Promise<EvidenceRecord> {
    return this.transition(id, 'reject')
  }

  /**
   * Duplicate detection within a workspace: exact by fingerprint, approximate
   * by normalized similarity. Returns non-rejected matches.
   */
  async findDuplicates(
    workspaceId: string,
    content: string,
  ): Promise<{ exact: EvidenceRecord[]; approximate: EvidenceRecord[] }> {
    const fingerprint = fingerprintContent(content.trim())
    const candidates = (await this.deps.evidence.listByWorkspace(workspaceId)).filter(
      (evidence) => evidence.status !== 'rejected',
    )
    const exact = candidates.filter((evidence) => evidence.fingerprint === fingerprint)
    const approximate = candidates.filter(
      (evidence) =>
        evidence.fingerprint !== fingerprint && isApproximateDuplicate(evidence.content, content),
    )
    return { exact, approximate }
  }

  async get(id: string): Promise<EvidenceRecord> {
    return this.mustFind(id)
  }

  async list(workspaceId: string): Promise<EvidenceRecord[]> {
    return this.deps.evidence.listByWorkspace(workspaceId)
  }

  private async transition(id: string, event: EvidenceEvent): Promise<EvidenceRecord> {
    const evidence = await this.mustFind(id)
    if (!canEvidenceTransition(evidence.status, event)) {
      throw new AppError('CONFLICT', `evidence cannot ${event} from status ${evidence.status}`)
    }
    await this.deps.evidence.updateStatus(id, nextEvidenceState(evidence.status, event))
    return this.mustFind(id)
  }

  private async mustFind(id: string): Promise<EvidenceRecord> {
    const evidence = await this.deps.evidence.findById(id)
    if (!evidence) {
      throw new AppError('NOT_FOUND', `evidence ${id} not found`)
    }
    return evidence
  }
}
