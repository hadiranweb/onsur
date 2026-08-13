import type {
  Capability,
  Evaluation,
  Evidence,
  Feedback,
  Island,
  MemoryEntry,
  MemoryScope,
  ProblemItem,
  Process,
  Provenance,
  RunEventType,
  SpsStatus,
  WorkspaceRole,
} from '@element-plus/contracts'
import type {
  ApprovalRecord,
  ApprovalRepository,
  ArtifactRecord,
  ArtifactRepository,
  CapabilityRepository,
  EffectRecordRow,
  EffectRepository,
  EvaluationRepository,
  EvidenceRecord,
  EvidenceRepository,
  FeedbackRecord,
  FeedbackRepository,
  IslandRepository,
  MembershipRecord,
  MembershipRepository,
  MemoryRecord,
  MemoryRepository,
  PasswordHasher,
  ProblemRecord,
  ProblemRepository,
  ProblemSpecificationRecord,
  ProblemSpecificationRepository,
  ProcessRepository,
  RunEventRecord,
  RunRecord,
  RunRepository,
  SessionCodec,
  SessionRecord,
  SessionRepository,
  SpsMessageRecord,
  SpsRepository,
  SpsSessionRecord,
  ToolCallRecord,
  ToolCallRepository,
  ToolCallStatus,
  UserRecord,
  UserRepository,
  WorkspaceRecord,
  WorkspaceRepository,
} from '../ports'
import { compareVersions } from '@element-plus/domain'
import { UniqueViolationError } from '../errors'

let seq = 0
function nextId(prefix: string): string {
  seq += 1
  return `${prefix}-${seq}`
}

export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, UserRecord>()
  private readonly byEmail = new Map<string, UserRecord>()

  async create(input: {
    id: string
    email: string
    passwordHash: string
    displayName: string
  }): Promise<UserRecord> {
    if (this.byEmail.has(input.email)) {
      throw new UniqueViolationError('users_email_key')
    }
    const now = new Date().toISOString()
    const record: UserRecord = {
      id: input.id,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      createdAt: now,
      updatedAt: now,
    }
    this.byId.set(record.id, record)
    this.byEmail.set(record.email, record)
    return record
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.byEmail.get(email) ?? null
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.byId.get(id) ?? null
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly byId = new Map<string, SessionRecord>()
  private readonly byTokenHash = new Map<string, SessionRecord>()

  async create(input: {
    id: string
    userId: string
    tokenHash: string
    expiresAt: string
  }): Promise<SessionRecord> {
    const record: SessionRecord = {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
      revokedAt: null,
    }
    this.byId.set(record.id, record)
    this.byTokenHash.set(record.tokenHash, record)
    return record
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.byTokenHash.get(tokenHash) ?? null
  }

  async revoke(id: string): Promise<void> {
    const record = this.byId.get(id)
    if (record) {
      record.revokedAt = new Date().toISOString()
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const record of this.byId.values()) {
      if (record.userId === userId && !record.revokedAt) {
        record.revokedAt = new Date().toISOString()
      }
    }
  }

  /** Test helper. */
  all(): SessionRecord[] {
    return [...this.byId.values()]
  }
}

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly byId = new Map<string, WorkspaceRecord>()
  private readonly bySlug = new Map<string, WorkspaceRecord>()

  async create(input: {
    id: string
    slug: string
    name: string
    kind: 'personal' | 'team'
    ownerUserId: string
  }): Promise<WorkspaceRecord> {
    if (this.bySlug.has(input.slug)) {
      throw new UniqueViolationError('workspaces_slug_key')
    }
    const now = new Date().toISOString()
    const record: WorkspaceRecord = {
      id: input.id,
      slug: input.slug,
      name: input.name,
      kind: input.kind,
      ownerUserId: input.ownerUserId,
      createdAt: now,
      updatedAt: now,
    }
    this.byId.set(record.id, record)
    this.bySlug.set(record.slug, record)
    return record
  }

  async findById(id: string): Promise<WorkspaceRecord | null> {
    return this.byId.get(id) ?? null
  }

  async findBySlug(slug: string): Promise<WorkspaceRecord | null> {
    return this.bySlug.get(slug) ?? null
  }

  async findPersonalByOwner(userId: string): Promise<WorkspaceRecord | null> {
    for (const record of this.byId.values()) {
      if (record.ownerUserId === userId && record.kind === 'personal') {
        return record
      }
    }
    return null
  }
}

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly byKey = new Map<string, MembershipRecord>()

  async create(input: {
    workspaceId: string
    userId: string
    role: WorkspaceRole
  }): Promise<MembershipRecord> {
    const record: MembershipRecord = {
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: input.role,
      createdAt: new Date().toISOString(),
    }
    this.byKey.set(this.key(record.workspaceId, record.userId), record)
    return record
  }

  async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    return this.byKey.get(this.key(workspaceId, userId)) ?? null
  }

  async listByUser(userId: string): Promise<MembershipRecord[]> {
    return [...this.byKey.values()].filter((record) => record.userId === userId)
  }

  async listByWorkspace(workspaceId: string): Promise<MembershipRecord[]> {
    return [...this.byKey.values()].filter((record) => record.workspaceId === workspaceId)
  }

  private key(workspaceId: string, userId: string): string {
    return `${workspaceId}::${userId}`
  }
}

/** Deterministic, non-secret fake hasher for unit tests. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `fake:${password}`
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `fake:${password}`
  }
}

/** Fake codec that mirrors the signing semantics of the real HMAC codec. */
export class FakeSessionCodec implements SessionCodec {
  create(): { cookieValue: string; tokenHash: string } {
    const token = nextId('token')
    return { cookieValue: `cookie(${token})`, tokenHash: `hash(${token})` }
  }

  parse(cookieValue: string | null | undefined): string | null {
    if (!cookieValue) {
      return null
    }
    const match = /^cookie\((.+)\)$/.exec(cookieValue)
    if (!match || !match[1]) {
      return null
    }
    return `hash(${match[1]})`
  }
}

export class InMemoryProblemRepository implements ProblemRepository {
  private readonly byId = new Map<string, ProblemRecord>()

  async create(input: {
    id: string
    workspaceId: string
    rawProblem: string
  }): Promise<ProblemRecord> {
    const now = new Date().toISOString()
    const record: ProblemRecord = {
      id: input.id,
      workspaceId: input.workspaceId,
      rawProblem: input.rawProblem,
      createdAt: now,
      updatedAt: now,
    }
    this.byId.set(record.id, record)
    return record
  }

  async findById(id: string): Promise<ProblemRecord | null> {
    return this.byId.get(id) ?? null
  }

  async listByWorkspace(workspaceId: string): Promise<ProblemRecord[]> {
    return [...this.byId.values()].filter((record) => record.workspaceId === workspaceId)
  }
}

export class InMemoryProblemSpecificationRepository implements ProblemSpecificationRepository {
  private readonly byId = new Map<string, ProblemSpecificationRecord>()

  async create(input: {
    id: string
    problemId: string
    workspaceId: string
    version: string
    status: 'draft' | 'confirmed' | 'superseded'
    rawProblem: string
    structuredUnderstanding: string
    items: ProblemItem[]
    successCriteria: string[]
    constraints: string[]
    provenance: Provenance
  }): Promise<ProblemSpecificationRecord> {
    const record: ProblemSpecificationRecord = {
      ...input,
      createdAt: new Date().toISOString(),
    }
    this.byId.set(record.id, record)
    return record
  }

  async findByProblemAndVersion(
    problemId: string,
    version: string,
  ): Promise<ProblemSpecificationRecord | null> {
    for (const record of this.byId.values()) {
      if (record.problemId === problemId && record.version === version) return record
    }
    return null
  }

  async findById(id: string): Promise<ProblemSpecificationRecord | null> {
    return this.byId.get(id) ?? null
  }

  async findLatestByProblem(problemId: string): Promise<ProblemSpecificationRecord | null> {
    const records = [...this.byId.values()].filter((record) => record.problemId === problemId)
    return maxByVersion(records)
  }

  async findConfirmedByProblem(problemId: string): Promise<ProblemSpecificationRecord | null> {
    const records = [...this.byId.values()].filter(
      (record) => record.problemId === problemId && record.status === 'confirmed',
    )
    return maxByVersion(records)
  }

  async updateStatus(id: string, status: 'draft' | 'confirmed' | 'superseded'): Promise<void> {
    const record = this.byId.get(id)
    if (record) {
      record.status = status
    }
  }

  all(): ProblemSpecificationRecord[] {
    return [...this.byId.values()]
  }
}

export class InMemorySpsRepository implements SpsRepository {
  private readonly sessions = new Map<string, SpsSessionRecord>()
  private readonly messages = new Map<string, SpsMessageRecord[]>()

  async createSession(input: {
    id: string
    workspaceId: string
    problemId: string
  }): Promise<SpsSessionRecord> {
    const now = new Date().toISOString()
    const record: SpsSessionRecord = {
      id: input.id,
      workspaceId: input.workspaceId,
      problemId: input.problemId,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    }
    this.sessions.set(record.id, record)
    return record
  }

  async findSessionById(id: string): Promise<SpsSessionRecord | null> {
    return this.sessions.get(id) ?? null
  }

  async updateStatus(id: string, status: SpsStatus): Promise<SpsSessionRecord> {
    const record = this.sessions.get(id)
    if (!record) {
      throw new Error(`session ${id} not found`)
    }
    record.status = status
    record.updatedAt = new Date().toISOString()
    return record
  }

  async addMessage(input: {
    id: string
    sessionId: string
    role: 'user' | 'assistant' | 'system'
    content: string
  }): Promise<SpsMessageRecord> {
    const existing = this.messages.get(input.sessionId) ?? []
    const record: SpsMessageRecord = {
      id: input.id,
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      seq: existing.length,
      createdAt: new Date().toISOString(),
    }
    this.messages.set(input.sessionId, [...existing, record])
    return record
  }

  async listMessages(sessionId: string): Promise<SpsMessageRecord[]> {
    return this.messages.get(sessionId) ?? []
  }

  async listSessionsByWorkspace(workspaceId: string): Promise<SpsSessionRecord[]> {
    return [...this.sessions.values()].filter((record) => record.workspaceId === workspaceId)
  }
}

function maxByVersion<T extends { version: string }>(records: T[]): T | null {
  if (records.length === 0) return null
  return records.reduce((max, record) =>
    compareVersions(record.version, max.version) > 0 ? record : max,
  )
}

const maxVersion = maxByVersion

export class InMemoryCapabilityRepository implements CapabilityRepository {
  private readonly byKey = new Map<string, Capability>()

  async create(input: Capability): Promise<Capability> {
    this.byKey.set(`${input.id}::${input.version}`, input)
    return input
  }

  async findById(id: string): Promise<Capability | null> {
    return maxVersion([...this.byKey.values()].filter((cap) => cap.id === id))
  }

  async findLatestById(id: string): Promise<Capability | null> {
    return this.findById(id)
  }

  async findLatestByName(name: string): Promise<Capability | null> {
    return maxVersion([...this.byKey.values()].filter((cap) => cap.name === name))
  }

  async list(): Promise<Capability[]> {
    return [...this.byKey.values()]
  }
}

export class InMemoryProcessRepository implements ProcessRepository {
  private readonly byKey = new Map<string, Process>()

  async create(input: Process): Promise<Process> {
    this.byKey.set(`${input.id}::${input.version}`, input)
    return input
  }

  async findById(id: string): Promise<Process | null> {
    return maxVersion([...this.byKey.values()].filter((process) => process.id === id))
  }

  async findLatestById(id: string): Promise<Process | null> {
    return this.findById(id)
  }

  async listByIdentity(id: string): Promise<Process[]> {
    return [...this.byKey.values()].filter((process) => process.id === id)
  }

  async list(): Promise<Process[]> {
    return [...this.byKey.values()]
  }

  async updateStatus(id: string, status: Process['status']): Promise<void> {
    for (const [key, process] of this.byKey) {
      if (key.startsWith(`${id}::`)) {
        process.status = status
      }
    }
  }

  all(): Process[] {
    return [...this.byKey.values()]
  }
}

export class InMemoryIslandRepository implements IslandRepository {
  private readonly byKey = new Map<string, Island>()

  async create(input: Island): Promise<Island> {
    this.byKey.set(`${input.id}::${input.version}`, input)
    return input
  }

  async findById(id: string): Promise<Island | null> {
    return maxVersion([...this.byKey.values()].filter((island) => island.id === id))
  }

  async findLatestById(id: string): Promise<Island | null> {
    return this.findById(id)
  }

  async listByIdentity(id: string): Promise<Island[]> {
    return [...this.byKey.values()].filter((island) => island.id === id)
  }

  async list(): Promise<Island[]> {
    return [...this.byKey.values()]
  }

  async listActive(): Promise<Island[]> {
    return [...this.byKey.values()].filter((island) => island.status === 'active')
  }

  async updateStatus(id: string, status: Island['status']): Promise<void> {
    for (const [key, island] of this.byKey) {
      if (key.startsWith(`${id}::`)) {
        island.status = status
      }
    }
  }

  all(): Island[] {
    return [...this.byKey.values()]
  }
}

export class InMemoryRunRepository implements RunRepository {
  private readonly byId = new Map<string, RunRecord>()
  private readonly events = new Map<string, RunEventRecord[]>()

  async create(input: RunRecord): Promise<RunRecord> {
    this.byId.set(input.id, input)
    return input
  }

  async findById(id: string): Promise<RunRecord | null> {
    return this.byId.get(id) ?? null
  }

  async updateStatus(id: string, status: RunRecord['status']): Promise<RunRecord> {
    const run = this.byId.get(id)
    if (!run) throw new Error(`run ${id} not found`)
    run.status = status
    run.updatedAt = new Date().toISOString()
    return run
  }

  async appendEvent(input: {
    runId: string
    type: RunEventType
    payload?: Record<string, unknown>
  }): Promise<RunEventRecord> {
    const existing = this.events.get(input.runId) ?? []
    const record: RunEventRecord = {
      id: nextId('run-event'),
      runId: input.runId,
      seq: existing.length,
      type: input.type,
      at: new Date().toISOString(),
      payload: input.payload ?? {},
    }
    this.events.set(input.runId, [...existing, record])
    return record
  }

  async listEvents(runId: string): Promise<RunEventRecord[]> {
    return this.events.get(runId) ?? []
  }

  async list(): Promise<RunRecord[]> {
    return [...this.byId.values()]
  }
}

export class InMemoryApprovalRepository implements ApprovalRepository {
  private readonly byId = new Map<string, ApprovalRecord>()

  async create(input: Omit<ApprovalRecord, 'requestedAt'>): Promise<ApprovalRecord> {
    const record: ApprovalRecord = { ...input, requestedAt: new Date().toISOString() }
    this.byId.set(record.id, record)
    return record
  }

  async findById(id: string): Promise<ApprovalRecord | null> {
    return this.byId.get(id) ?? null
  }

  async listByRun(runId: string): Promise<ApprovalRecord[]> {
    return [...this.byId.values()].filter((approval) => approval.runId === runId)
  }

  async decide(
    id: string,
    status: 'approved' | 'rejected',
    decidedBy: string,
  ): Promise<ApprovalRecord> {
    const record = this.byId.get(id)
    if (!record) throw new Error(`approval ${id} not found`)
    record.status = status
    record.decidedAt = new Date().toISOString()
    record.decidedBy = decidedBy
    return record
  }
}

export class InMemoryToolCallRepository implements ToolCallRepository {
  private readonly byId = new Map<string, ToolCallRecord>()

  async create(input: Omit<ToolCallRecord, 'createdAt'>): Promise<ToolCallRecord> {
    const record: ToolCallRecord = { ...input, createdAt: new Date().toISOString() }
    this.byId.set(record.id, record)
    return record
  }

  async findById(id: string): Promise<ToolCallRecord | null> {
    return this.byId.get(id) ?? null
  }

  async listByRun(runId: string): Promise<ToolCallRecord[]> {
    return [...this.byId.values()].filter((toolCall) => toolCall.runId === runId)
  }

  async updateStatus(id: string, status: ToolCallStatus): Promise<void> {
    const record = this.byId.get(id)
    if (record) record.status = status
  }
}

export class InMemoryEffectRepository implements EffectRepository {
  private readonly byId = new Map<string, EffectRecordRow>()

  async create(input: Omit<EffectRecordRow, 'occurredAt'>): Promise<EffectRecordRow> {
    const record: EffectRecordRow = { ...input, occurredAt: new Date().toISOString() }
    this.byId.set(record.id, record)
    return record
  }

  async listByRun(runId: string): Promise<EffectRecordRow[]> {
    return [...this.byId.values()].filter((effect) => effect.runId === runId)
  }
}

export class InMemoryArtifactRepository implements ArtifactRepository {
  private readonly byId = new Map<string, ArtifactRecord>()

  async create(input: Omit<ArtifactRecord, 'createdAt'>): Promise<ArtifactRecord> {
    const record: ArtifactRecord = { ...input, createdAt: new Date().toISOString() }
    this.byId.set(record.id, record)
    return record
  }

  async listByRun(runId: string): Promise<ArtifactRecord[]> {
    return [...this.byId.values()].filter((artifact) => artifact.runId === runId)
  }
}

export class InMemoryEvaluationRepository implements EvaluationRepository {
  private readonly byId = new Map<string, Evaluation>()

  async create(input: Evaluation): Promise<Evaluation> {
    this.byId.set(input.id, input)
    return input
  }

  async listByRun(runId: string): Promise<Evaluation[]> {
    return [...this.byId.values()].filter((evaluation) => evaluation.runId.id === runId)
  }
}

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private readonly byId = new Map<string, EvidenceRecord>()

  async create(input: Omit<EvidenceRecord, 'createdAt'>): Promise<EvidenceRecord> {
    const record: EvidenceRecord = { ...input, createdAt: new Date().toISOString() }
    this.byId.set(record.id, record)
    return record
  }

  async findById(id: string): Promise<EvidenceRecord | null> {
    return this.byId.get(id) ?? null
  }

  async updateStatus(id: string, status: Evidence['status']): Promise<void> {
    const record = this.byId.get(id)
    if (record) record.status = status
  }

  async listByWorkspace(workspaceId: string): Promise<EvidenceRecord[]> {
    return [...this.byId.values()].filter((record) => record.workspaceId === workspaceId)
  }

  all(): EvidenceRecord[] {
    return [...this.byId.values()]
  }
}

export class InMemoryFeedbackRepository implements FeedbackRepository {
  private readonly byId = new Map<string, FeedbackRecord>()

  async create(input: Omit<FeedbackRecord, 'createdAt'>): Promise<FeedbackRecord> {
    const record: FeedbackRecord = { ...input, createdAt: new Date().toISOString() }
    this.byId.set(record.id, record)
    return record
  }

  async findById(id: string): Promise<FeedbackRecord | null> {
    return this.byId.get(id) ?? null
  }

  async updateStatus(id: string, status: Feedback['status']): Promise<void> {
    const record = this.byId.get(id)
    if (record) record.status = status
  }

  async listByRun(runId: string): Promise<FeedbackRecord[]> {
    return [...this.byId.values()].filter((record) => record.runId.id === runId)
  }

  all(): FeedbackRecord[] {
    return [...this.byId.values()]
  }
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly byId = new Map<string, MemoryRecord>()

  async create(input: Omit<MemoryRecord, 'createdAt'>): Promise<MemoryRecord> {
    const record: MemoryRecord = { ...input, createdAt: new Date().toISOString() }
    this.byId.set(record.id, record)
    return record
  }

  async findById(id: string): Promise<MemoryRecord | null> {
    return this.byId.get(id) ?? null
  }

  async updateStatus(id: string, status: MemoryEntry['status']): Promise<void> {
    const record = this.byId.get(id)
    if (record) record.status = status
  }

  async listByOwner(ownerId: string): Promise<MemoryRecord[]> {
    return [...this.byId.values()].filter((record) => record.ownerId === ownerId)
  }

  async listByWorkspace(workspaceId: string): Promise<MemoryRecord[]> {
    return [...this.byId.values()].filter((record) => record.workspaceId === workspaceId)
  }

  async listByScope(scope: MemoryScope): Promise<MemoryRecord[]> {
    return [...this.byId.values()].filter((record) => record.scope === scope)
  }

  all(): MemoryRecord[] {
    return [...this.byId.values()]
  }
}
