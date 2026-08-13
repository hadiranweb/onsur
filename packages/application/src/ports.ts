import type {
  ArtifactKind,
  Capability,
  EffectKind,
  Evaluation,
  Evidence,
  Feedback,
  Island,
  IslandStatus,
  Knowledge,
  KnowledgeStatus,
  MemoryEntry,
  MemoryScope,
  ProblemItem,
  Process,
  ProcessStatus,
  Provenance,
  RunEventType,
  RunSnapshot,
  RunStatus,
  SpsStatus,
  StructuredProblemOutput,
  ToolContract,
  VersionProposal,
  VersionProposalStatus,
  WorkspaceRole,
} from '@element-plus/contracts'

/**
 * Persistence and infrastructure ports. The application layer depends on these
 * interfaces only; adapters (PostgreSQL, in-memory fakes, crypto) implement
 * them. Dates are ISO-8601 strings.
 */

export interface UserRecord {
  id: string
  email: string
  passwordHash: string
  displayName: string
  createdAt: string
  updatedAt: string
}

export interface SessionRecord {
  id: string
  userId: string
  tokenHash: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
}

export interface WorkspaceRecord {
  id: string
  slug: string
  name: string
  kind: 'personal' | 'team'
  ownerUserId: string
  createdAt: string
  updatedAt: string
}

export interface MembershipRecord {
  workspaceId: string
  userId: string
  role: WorkspaceRole
  createdAt: string
}

export interface UserRepository {
  create(input: {
    id: string
    email: string
    passwordHash: string
    displayName: string
  }): Promise<UserRecord>
  findByEmail(email: string): Promise<UserRecord | null>
  findById(id: string): Promise<UserRecord | null>
}

export interface SessionRepository {
  create(input: {
    id: string
    userId: string
    tokenHash: string
    expiresAt: string
  }): Promise<SessionRecord>
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>
  revoke(id: string): Promise<void>
  revokeAllForUser(userId: string): Promise<void>
}

export interface WorkspaceRepository {
  create(input: {
    id: string
    slug: string
    name: string
    kind: 'personal' | 'team'
    ownerUserId: string
  }): Promise<WorkspaceRecord>
  findById(id: string): Promise<WorkspaceRecord | null>
  findBySlug(slug: string): Promise<WorkspaceRecord | null>
  findPersonalByOwner(userId: string): Promise<WorkspaceRecord | null>
}

export interface MembershipRepository {
  create(input: {
    workspaceId: string
    userId: string
    role: WorkspaceRole
  }): Promise<MembershipRecord>
  findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<MembershipRecord | null>
  listByUser(userId: string): Promise<MembershipRecord[]>
  listByWorkspace(workspaceId: string): Promise<MembershipRecord[]>
}

export interface PasswordHasher {
  hash(password: string): Promise<string>
  verify(password: string, hash: string): Promise<boolean>
}

/**
 * A session codec issues an opaque token, stores only its hash, and returns a
 * signed cookie value. `parse` returns the token hash for a valid cookie value
 * and null otherwise (tampered, missing, or malformed).
 */
export interface SessionCodec {
  create(): { cookieValue: string; tokenHash: string }
  parse(cookieValue: string | null | undefined): string | null
}

// ---------------------------------------------------------------------------
// Problem / SPS persistence (Sprint 03)
// ---------------------------------------------------------------------------

export interface ProblemRecord {
  id: string
  workspaceId: string
  rawProblem: string
  createdAt: string
  updatedAt: string
}

export interface ProblemSpecificationRecord {
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
  createdAt: string
}

export interface SpsSessionRecord {
  id: string
  workspaceId: string
  problemId: string
  status: SpsStatus
  createdAt: string
  updatedAt: string
}

export interface SpsMessageRecord {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  seq: number
  createdAt: string
}

export interface ProblemRepository {
  create(input: { id: string; workspaceId: string; rawProblem: string }): Promise<ProblemRecord>
  findById(id: string): Promise<ProblemRecord | null>
  listByWorkspace(workspaceId: string): Promise<ProblemRecord[]>
}

export interface ProblemSpecificationRepository {
  create(input: {
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
  }): Promise<ProblemSpecificationRecord>
  findById(id: string): Promise<ProblemSpecificationRecord | null>
  findByProblemAndVersion(
    problemId: string,
    version: string,
  ): Promise<ProblemSpecificationRecord | null>
  findLatestByProblem(problemId: string): Promise<ProblemSpecificationRecord | null>
  findConfirmedByProblem(problemId: string): Promise<ProblemSpecificationRecord | null>
  updateStatus(id: string, status: 'draft' | 'confirmed' | 'superseded'): Promise<void>
}

export interface SpsRepository {
  createSession(input: {
    id: string
    workspaceId: string
    problemId: string
  }): Promise<SpsSessionRecord>
  findSessionById(id: string): Promise<SpsSessionRecord | null>
  updateStatus(id: string, status: SpsStatus): Promise<SpsSessionRecord>
  addMessage(input: {
    id: string
    sessionId: string
    role: 'user' | 'assistant' | 'system'
    content: string
  }): Promise<SpsMessageRecord>
  listMessages(sessionId: string): Promise<SpsMessageRecord[]>
  listSessionsByWorkspace(workspaceId: string): Promise<SpsSessionRecord[]>
}

/**
 * The structured LLM port. Any provider (a deterministic fake in tests/dev, or
 * a real model later) implements this interface; its output is untrusted until
 * the Founder service validates it against `structuredProblemOutputSchema`.
 */
export interface StructuredLlmPort {
  structure(input: StructuredLlmRequest): Promise<StructuredProblemOutput>
}

export interface StructuredLlmRequest {
  rawProblem: string
  corrections: string[]
}

// ---------------------------------------------------------------------------
// Capability / Process / Island registries (Sprint 04)
// ---------------------------------------------------------------------------

export interface CapabilityRepository {
  create(input: Capability): Promise<Capability>
  findById(id: string): Promise<Capability | null>
  findLatestById(id: string): Promise<Capability | null>
  findLatestByName(name: string): Promise<Capability | null>
  list(): Promise<Capability[]>
}

export interface ProcessRepository {
  create(input: Process): Promise<Process>
  findById(id: string): Promise<Process | null>
  findLatestById(id: string): Promise<Process | null>
  listByIdentity(id: string): Promise<Process[]>
  list(): Promise<Process[]>
  updateStatus(id: string, status: ProcessStatus): Promise<void>
}

export interface IslandRepository {
  create(input: Island): Promise<Island>
  findById(id: string): Promise<Island | null>
  findLatestById(id: string): Promise<Island | null>
  listByIdentity(id: string): Promise<Island[]>
  list(): Promise<Island[]>
  listActive(): Promise<Island[]>
  updateStatus(id: string, status: IslandStatus): Promise<void>
}

// ---------------------------------------------------------------------------
// Run engine (Sprint 05)
// ---------------------------------------------------------------------------

export interface RunRecord {
  id: string
  status: RunStatus
  snapshot: RunSnapshot
  provenance: Provenance
  createdAt: string
  updatedAt: string
}

export interface RunEventRecord {
  id: string
  runId: string
  seq: number
  type: RunEventType
  at: string
  payload: Record<string, unknown>
}

export type ToolCallStatus = 'requested' | 'approved' | 'rejected' | 'denied' | 'executed'

export interface ToolCallRecord {
  id: string
  runId: string
  toolId: string
  toolName: string
  arguments: Record<string, unknown>
  effectKind: EffectKind
  requiresApproval: boolean
  status: ToolCallStatus
  createdAt: string
}

export interface ApprovalRecord {
  id: string
  runId: string
  toolCallId: string
  effectKind: EffectKind
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: string
  decidedAt: string | null
  decidedBy: string | null
}

export interface EffectRecordRow {
  id: string
  runId: string
  toolCallId: string
  kind: EffectKind
  description: string
  occurredAt: string
  reverted: boolean
}

export interface ArtifactRecord {
  id: string
  runId: string
  kind: ArtifactKind
  mimeType: string
  sizeBytes: number | null
  data: unknown
  provenance: Provenance
  createdAt: string
}

export interface RunRepository {
  create(input: RunRecord): Promise<RunRecord>
  findById(id: string): Promise<RunRecord | null>
  updateStatus(id: string, status: RunStatus): Promise<RunRecord>
  appendEvent(input: {
    runId: string
    type: RunEventType
    payload?: Record<string, unknown>
  }): Promise<RunEventRecord>
  listEvents(runId: string): Promise<RunEventRecord[]>
  list(): Promise<RunRecord[]>
}

export interface ApprovalRepository {
  create(input: Omit<ApprovalRecord, 'requestedAt'>): Promise<ApprovalRecord>
  findById(id: string): Promise<ApprovalRecord | null>
  listByRun(runId: string): Promise<ApprovalRecord[]>
  decide(id: string, status: 'approved' | 'rejected', decidedBy: string): Promise<ApprovalRecord>
}

export interface ToolCallRepository {
  create(input: Omit<ToolCallRecord, 'createdAt'>): Promise<ToolCallRecord>
  findById(id: string): Promise<ToolCallRecord | null>
  listByRun(runId: string): Promise<ToolCallRecord[]>
  updateStatus(id: string, status: ToolCallStatus): Promise<void>
}

export interface EffectRepository {
  create(input: Omit<EffectRecordRow, 'occurredAt'>): Promise<EffectRecordRow>
  listByRun(runId: string): Promise<EffectRecordRow[]>
}

export interface ArtifactRepository {
  create(input: Omit<ArtifactRecord, 'createdAt'>): Promise<ArtifactRecord>
  listByRun(runId: string): Promise<ArtifactRecord[]>
}

export interface EvaluationRepository {
  create(input: Evaluation): Promise<Evaluation>
  listByRun(runId: string): Promise<Evaluation[]>
}

// ---------------------------------------------------------------------------
// Evidence / Feedback / Memory (Sprint 07)
// ---------------------------------------------------------------------------

export type EvidenceRecord = Evidence & { createdAt: string }
export type FeedbackRecord = Feedback & { createdAt: string }
export type MemoryRecord = MemoryEntry & { createdAt: string }

export interface EvidenceRepository {
  create(input: Omit<EvidenceRecord, 'createdAt'>): Promise<EvidenceRecord>
  findById(id: string): Promise<EvidenceRecord | null>
  updateStatus(id: string, status: Evidence['status']): Promise<void>
  listByWorkspace(workspaceId: string): Promise<EvidenceRecord[]>
}

export interface FeedbackRepository {
  create(input: Omit<FeedbackRecord, 'createdAt'>): Promise<FeedbackRecord>
  findById(id: string): Promise<FeedbackRecord | null>
  updateStatus(id: string, status: Feedback['status']): Promise<void>
  listByRun(runId: string): Promise<FeedbackRecord[]>
}

export interface MemoryRepository {
  create(input: Omit<MemoryRecord, 'createdAt'>): Promise<MemoryRecord>
  findById(id: string): Promise<MemoryRecord | null>
  updateStatus(id: string, status: MemoryEntry['status']): Promise<void>
  listByOwner(ownerId: string): Promise<MemoryRecord[]>
  listByWorkspace(workspaceId: string): Promise<MemoryRecord[]>
  listByScope(scope: MemoryScope): Promise<MemoryRecord[]>
}

// ---------------------------------------------------------------------------
// Knowledge governance / VersionProposal (Sprint 08)
// ---------------------------------------------------------------------------

export type KnowledgeRecord = Knowledge & { createdAt: string }
export type VersionProposalRecord = VersionProposal & { createdAt: string }

export interface KnowledgeRepository {
  create(input: Omit<KnowledgeRecord, 'createdAt'>): Promise<KnowledgeRecord>
  findById(id: string): Promise<KnowledgeRecord | null>
  findLatestById(id: string): Promise<KnowledgeRecord | null>
  findVersion(id: string, version: string): Promise<KnowledgeRecord | null>
  listByIdentity(id: string): Promise<KnowledgeRecord[]>
  listByWorkspace(workspaceId: string): Promise<KnowledgeRecord[]>
  updateStatus(id: string, version: string, status: KnowledgeStatus): Promise<void>
}

export interface VersionProposalRepository {
  create(input: Omit<VersionProposalRecord, 'createdAt'>): Promise<VersionProposalRecord>
  findById(id: string): Promise<VersionProposalRecord | null>
  updateStatus(id: string, status: VersionProposalStatus): Promise<void>
  listByTarget(targetId: string): Promise<VersionProposalRecord[]>
  list(): Promise<VersionProposalRecord[]>
}

/** Registry of ToolContracts, resolved by id at run time. */
export interface ToolRegistry {
  get(id: string): ToolContract | null
  list(): ToolContract[]
}

export interface RuntimeError {
  code: string
  message: string
}

export type RuntimeEvent =
  | { type: 'started' }
  | { type: 'log'; message: string }
  | { type: 'tool_result'; toolCallId: string; result: unknown }
  | { type: 'completed'; result: unknown }
  | { type: 'failed'; error: RuntimeError }

export interface RuntimeSession {
  runId: string
  island: Island
  process: Process | null
  problemSpec: ProblemSpecificationRecord
  /** Aborted when the Run is cancelled; adapters should unwind promptly. */
  signal?: AbortSignal
}

export interface ToolGateRequest {
  toolId: string
  arguments: Record<string, unknown>
}

export interface ToolGateResult {
  allowed: boolean
  reason?: 'denied' | 'rejected' | 'cancelled'
  toolCallId: string
}

/**
 * The gate every runtime goes through before executing an effectful tool.
 * Default deny: `allowed: false` means the tool must not execute.
 */
export interface ToolGate {
  request(request: ToolGateRequest): Promise<ToolGateResult>
}

/**
 * A RuntimeAdapter executes Element Plus contracts. OpenClaw (Sprint 06) is one
 * adapter; the fake adapter (Sprint 05) is another. Adapters never redefine
 * contracts.
 */
export interface RuntimeAdapter {
  readonly kind: 'fake' | 'openclaw'
  start(session: RuntimeSession): AsyncIterable<RuntimeEvent>
}
