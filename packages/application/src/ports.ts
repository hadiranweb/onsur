import type {
  Capability,
  Island,
  IslandStatus,
  ProblemItem,
  Process,
  ProcessStatus,
  Provenance,
  SpsStatus,
  StructuredProblemOutput,
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
