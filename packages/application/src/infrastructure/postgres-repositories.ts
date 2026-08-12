import type { Pool } from 'pg'
import type {
  Capability,
  Island,
  IslandStatus,
  ProblemItem,
  Process,
  ProcessStatus,
  Provenance,
  Reference,
  SpsStatus,
  WorkspaceRole,
} from '@element-plus/contracts'
import { compareVersions } from '@element-plus/domain'
import { UniqueViolationError } from '../errors'
import type {
  CapabilityRepository,
  IslandRepository,
  MembershipRecord,
  MembershipRepository,
  ProblemRecord,
  ProblemRepository,
  ProblemSpecificationRecord,
  ProblemSpecificationRepository,
  ProcessRepository,
  SessionRecord,
  SessionRepository,
  SpsMessageRecord,
  SpsRepository,
  SpsSessionRecord,
  UserRecord,
  UserRepository,
  WorkspaceRecord,
  WorkspaceRepository,
} from '../ports'

function toIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    return new Date(value).toISOString()
  }
  throw new Error(`unexpected timestamp value: ${String(value)}`)
}

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    displayName: row.display_name as string,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function mapSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tokenHash: row.token_hash as string,
    createdAt: toIso(row.created_at),
    expiresAt: toIso(row.expires_at),
    revokedAt: row.revoked_at == null ? null : toIso(row.revoked_at),
  }
}

function mapWorkspace(row: Record<string, unknown>): WorkspaceRecord {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    kind: row.kind as 'personal' | 'team',
    ownerUserId: row.owner_user_id as string,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function mapMembership(row: Record<string, unknown>): MembershipRecord {
  return {
    workspaceId: row.workspace_id as string,
    userId: row.user_id as string,
    role: row.role as WorkspaceRole,
    createdAt: toIso(row.created_at),
  }
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: {
    id: string
    email: string
    passwordHash: string
    displayName: string
  }): Promise<UserRecord> {
    try {
      const result = await this.pool.query(
        `INSERT INTO users (id, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, password_hash, display_name, created_at, updated_at`,
        [input.id, input.email, input.passwordHash, input.displayName],
      )
      return mapUser(result.rows[0])
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UniqueViolationError('users_email_key')
      }
      throw error
    }
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.pool.query(
      `SELECT id, email, password_hash, display_name, created_at, updated_at
         FROM users WHERE email = $1`,
      [email],
    )
    return result.rows[0] ? mapUser(result.rows[0]) : null
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.pool.query(
      `SELECT id, email, password_hash, display_name, created_at, updated_at
         FROM users WHERE id = $1`,
      [id],
    )
    return result.rows[0] ? mapUser(result.rows[0]) : null
  }
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: {
    id: string
    userId: string
    tokenHash: string
    expiresAt: string
  }): Promise<SessionRecord> {
    const result = await this.pool.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, token_hash, created_at, expires_at, revoked_at`,
      [input.id, input.userId, input.tokenHash, new Date(input.expiresAt)],
    )
    return mapSession(result.rows[0])
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const result = await this.pool.query(
      `SELECT id, user_id, token_hash, created_at, expires_at, revoked_at
         FROM sessions WHERE token_hash = $1`,
      [tokenHash],
    )
    return result.rows[0] ? mapSession(result.rows[0]) : null
  }

  async revoke(id: string): Promise<void> {
    await this.pool.query(`UPDATE sessions SET revoked_at = now() WHERE id = $1`, [id])
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    )
  }
}

export class PostgresWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: {
    id: string
    slug: string
    name: string
    kind: 'personal' | 'team'
    ownerUserId: string
  }): Promise<WorkspaceRecord> {
    try {
      const result = await this.pool.query(
        `INSERT INTO workspaces (id, slug, name, kind, owner_user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, slug, name, kind, owner_user_id, created_at, updated_at`,
        [input.id, input.slug, input.name, input.kind, input.ownerUserId],
      )
      return mapWorkspace(result.rows[0])
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UniqueViolationError('workspaces_slug_key')
      }
      throw error
    }
  }

  async findById(id: string): Promise<WorkspaceRecord | null> {
    const result = await this.pool.query(
      `SELECT id, slug, name, kind, owner_user_id, created_at, updated_at
         FROM workspaces WHERE id = $1`,
      [id],
    )
    return result.rows[0] ? mapWorkspace(result.rows[0]) : null
  }

  async findBySlug(slug: string): Promise<WorkspaceRecord | null> {
    const result = await this.pool.query(
      `SELECT id, slug, name, kind, owner_user_id, created_at, updated_at
         FROM workspaces WHERE slug = $1`,
      [slug],
    )
    return result.rows[0] ? mapWorkspace(result.rows[0]) : null
  }

  async findPersonalByOwner(userId: string): Promise<WorkspaceRecord | null> {
    const result = await this.pool.query(
      `SELECT id, slug, name, kind, owner_user_id, created_at, updated_at
         FROM workspaces WHERE owner_user_id = $1 AND kind = 'personal'`,
      [userId],
    )
    return result.rows[0] ? mapWorkspace(result.rows[0]) : null
  }
}

export class PostgresMembershipRepository implements MembershipRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: {
    workspaceId: string
    userId: string
    role: WorkspaceRole
  }): Promise<MembershipRecord> {
    const result = await this.pool.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING workspace_id, user_id, role, created_at`,
      [input.workspaceId, input.userId, input.role],
    )
    return mapMembership(result.rows[0])
  }

  async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    const result = await this.pool.query(
      `SELECT workspace_id, user_id, role, created_at
         FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    )
    return result.rows[0] ? mapMembership(result.rows[0]) : null
  }

  async listByUser(userId: string): Promise<MembershipRecord[]> {
    const result = await this.pool.query(
      `SELECT workspace_id, user_id, role, created_at
         FROM workspace_memberships WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    )
    return result.rows.map(mapMembership)
  }

  async listByWorkspace(workspaceId: string): Promise<MembershipRecord[]> {
    const result = await this.pool.query(
      `SELECT workspace_id, user_id, role, created_at
         FROM workspace_memberships WHERE workspace_id = $1 ORDER BY created_at ASC`,
      [workspaceId],
    )
    return result.rows.map(mapMembership)
  }
}

function mapProblem(row: Record<string, unknown>): ProblemRecord {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    rawProblem: row.raw_problem as string,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function mapSpecification(row: Record<string, unknown>): ProblemSpecificationRecord {
  return {
    id: row.id as string,
    problemId: row.problem_id as string,
    workspaceId: row.workspace_id as string,
    version: row.version as string,
    status: row.status as 'draft' | 'confirmed' | 'superseded',
    rawProblem: row.raw_problem as string,
    structuredUnderstanding: row.structured_understanding as string,
    items: row.items as ProblemItem[],
    successCriteria: row.success_criteria as string[],
    constraints: row.constraints as string[],
    provenance: row.provenance as Provenance,
    createdAt: toIso(row.created_at),
  }
}

function mapSpsSession(row: Record<string, unknown>): SpsSessionRecord {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    problemId: row.problem_id as string,
    status: row.status as SpsStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

function mapSpsMessage(row: Record<string, unknown>): SpsMessageRecord {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    role: row.role as 'user' | 'assistant' | 'system',
    content: row.content as string,
    seq: Number(row.seq),
    createdAt: toIso(row.created_at),
  }
}

export class PostgresProblemRepository implements ProblemRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: {
    id: string
    workspaceId: string
    rawProblem: string
  }): Promise<ProblemRecord> {
    const result = await this.pool.query(
      `INSERT INTO problems (id, workspace_id, raw_problem)
       VALUES ($1, $2, $3)
       RETURNING id, workspace_id, raw_problem, created_at, updated_at`,
      [input.id, input.workspaceId, input.rawProblem],
    )
    return mapProblem(result.rows[0])
  }

  async findById(id: string): Promise<ProblemRecord | null> {
    const result = await this.pool.query(
      `SELECT id, workspace_id, raw_problem, created_at, updated_at
         FROM problems WHERE id = $1`,
      [id],
    )
    return result.rows[0] ? mapProblem(result.rows[0]) : null
  }

  async listByWorkspace(workspaceId: string): Promise<ProblemRecord[]> {
    const result = await this.pool.query(
      `SELECT id, workspace_id, raw_problem, created_at, updated_at
         FROM problems WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId],
    )
    return result.rows.map(mapProblem)
  }
}

export class PostgresProblemSpecificationRepository implements ProblemSpecificationRepository {
  constructor(private readonly pool: Pool) {}

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
    const result = await this.pool.query(
      `INSERT INTO problem_specifications
         (id, problem_id, workspace_id, version, status, raw_problem,
          structured_understanding, items, success_criteria, constraints, provenance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, problem_id, workspace_id, version, status, raw_problem,
                 structured_understanding, items, success_criteria, constraints,
                 provenance, created_at`,
      [
        input.id,
        input.problemId,
        input.workspaceId,
        input.version,
        input.status,
        input.rawProblem,
        input.structuredUnderstanding,
        JSON.stringify(input.items),
        JSON.stringify(input.successCriteria),
        JSON.stringify(input.constraints),
        JSON.stringify(input.provenance),
      ],
    )
    return mapSpecification(result.rows[0])
  }

  async findByProblemAndVersion(
    problemId: string,
    version: string,
  ): Promise<ProblemSpecificationRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM problem_specifications WHERE problem_id = $1 AND version = $2`,
      [problemId, version],
    )
    return result.rows[0] ? mapSpecification(result.rows[0]) : null
  }

  async findLatestByProblem(problemId: string): Promise<ProblemSpecificationRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM problem_specifications WHERE problem_id = $1`,
      [problemId],
    )
    return maxVersion(result.rows.map(mapSpecification))
  }

  async findConfirmedByProblem(problemId: string): Promise<ProblemSpecificationRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM problem_specifications
         WHERE problem_id = $1 AND status = 'confirmed'`,
      [problemId],
    )
    return maxVersion(result.rows.map(mapSpecification))
  }

  async updateStatus(id: string, status: 'draft' | 'confirmed' | 'superseded'): Promise<void> {
    await this.pool.query(`UPDATE problem_specifications SET status = $2 WHERE id = $1`, [
      id,
      status,
    ])
  }
}

export class PostgresSpsRepository implements SpsRepository {
  constructor(private readonly pool: Pool) {}

  async createSession(input: {
    id: string
    workspaceId: string
    problemId: string
  }): Promise<SpsSessionRecord> {
    const result = await this.pool.query(
      `INSERT INTO sps_sessions (id, workspace_id, problem_id)
       VALUES ($1, $2, $3)
       RETURNING id, workspace_id, problem_id, status, created_at, updated_at`,
      [input.id, input.workspaceId, input.problemId],
    )
    return mapSpsSession(result.rows[0])
  }

  async findSessionById(id: string): Promise<SpsSessionRecord | null> {
    const result = await this.pool.query(
      `SELECT id, workspace_id, problem_id, status, created_at, updated_at
         FROM sps_sessions WHERE id = $1`,
      [id],
    )
    return result.rows[0] ? mapSpsSession(result.rows[0]) : null
  }

  async updateStatus(id: string, status: SpsStatus): Promise<SpsSessionRecord> {
    const result = await this.pool.query(
      `UPDATE sps_sessions SET status = $2, updated_at = now() WHERE id = $1
       RETURNING id, workspace_id, problem_id, status, created_at, updated_at`,
      [id, status],
    )
    return mapSpsSession(result.rows[0])
  }

  async addMessage(input: {
    id: string
    sessionId: string
    role: 'user' | 'assistant' | 'system'
    content: string
  }): Promise<SpsMessageRecord> {
    const result = await this.pool.query(
      `INSERT INTO sps_messages (id, session_id, role, content, seq)
       VALUES ($1, $2, $3, $4,
         (SELECT COALESCE(MAX(seq), 0) + 1 FROM sps_messages WHERE session_id = $2))
       RETURNING id, session_id, role, content, seq, created_at`,
      [input.id, input.sessionId, input.role, input.content],
    )
    return mapSpsMessage(result.rows[0])
  }

  async listMessages(sessionId: string): Promise<SpsMessageRecord[]> {
    const result = await this.pool.query(
      `SELECT id, session_id, role, content, seq, created_at
         FROM sps_messages WHERE session_id = $1 ORDER BY seq ASC`,
      [sessionId],
    )
    return result.rows.map(mapSpsMessage)
  }

  async listSessionsByWorkspace(workspaceId: string): Promise<SpsSessionRecord[]> {
    const result = await this.pool.query(
      `SELECT id, workspace_id, problem_id, status, created_at, updated_at
         FROM sps_sessions WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId],
    )
    return result.rows.map(mapSpsSession)
  }
}

export interface PostgresRepositories {
  users: UserRepository
  sessions: SessionRepository
  workspaces: WorkspaceRepository
  memberships: MembershipRepository
  problems: ProblemRepository
  specifications: ProblemSpecificationRepository
  sps: SpsRepository
  capabilities: CapabilityRepository
  processes: ProcessRepository
  islands: IslandRepository
}

export function createPostgresRepositories(pool: Pool): PostgresRepositories {
  return {
    users: new PostgresUserRepository(pool),
    sessions: new PostgresSessionRepository(pool),
    workspaces: new PostgresWorkspaceRepository(pool),
    memberships: new PostgresMembershipRepository(pool),
    problems: new PostgresProblemRepository(pool),
    specifications: new PostgresProblemSpecificationRepository(pool),
    sps: new PostgresSpsRepository(pool),
    capabilities: new PostgresCapabilityRepository(pool),
    processes: new PostgresProcessRepository(pool),
    islands: new PostgresIslandRepository(pool),
  }
}

function mapCapability(row: Record<string, unknown>): Capability {
  return {
    id: row.id as string,
    version: row.version as string,
    name: row.name as string,
    description: row.description as string,
    tags: (row.tags as string[]) ?? [],
    provenance: row.provenance as Provenance,
  }
}

function mapProcess(row: Record<string, unknown>): Process {
  return {
    id: row.id as string,
    version: row.version as string,
    status: row.status as Process['status'],
    title: row.title as string,
    description: row.description as string,
    steps: row.steps as Process['steps'],
    provenance: row.provenance as Provenance,
  }
}

function mapIsland(row: Record<string, unknown>): Island {
  return {
    id: row.id as string,
    version: row.version as string,
    status: row.status as IslandStatus,
    name: row.name as string,
    description: row.description as string,
    capabilities: row.capabilities as Reference[],
    runtime: row.runtime as Island['runtime'],
    permissions: (row.permissions as string[]) ?? [],
    provenance: row.provenance as Provenance,
  }
}

const CAPABILITY_COLUMNS = 'id, version, name, description, tags, provenance'
const PROCESS_COLUMNS = 'id, version, status, title, description, steps, provenance'
const ISLAND_COLUMNS =
  'id, version, status, name, description, capabilities, runtime, permissions, provenance'

export class PostgresCapabilityRepository implements CapabilityRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: Capability): Promise<Capability> {
    const result = await this.pool.query(
      `INSERT INTO capabilities (id, version, name, description, tags, provenance)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CAPABILITY_COLUMNS}`,
      [
        input.id,
        input.version,
        input.name,
        input.description,
        JSON.stringify(input.tags),
        JSON.stringify(input.provenance),
      ],
    )
    return mapCapability(result.rows[0])
  }

  async findById(id: string): Promise<Capability | null> {
    const result = await this.pool.query(
      `SELECT ${CAPABILITY_COLUMNS} FROM capabilities WHERE id = $1`,
      [id],
    )
    return maxVersion(result.rows.map(mapCapability))
  }

  async findLatestById(id: string): Promise<Capability | null> {
    return this.findById(id)
  }

  async findLatestByName(name: string): Promise<Capability | null> {
    const result = await this.pool.query(
      `SELECT ${CAPABILITY_COLUMNS} FROM capabilities WHERE name = $1`,
      [name],
    )
    return maxVersion(result.rows.map(mapCapability))
  }

  async list(): Promise<Capability[]> {
    const result = await this.pool.query(
      `SELECT ${CAPABILITY_COLUMNS} FROM capabilities ORDER BY name ASC`,
    )
    return result.rows.map(mapCapability)
  }
}

export class PostgresProcessRepository implements ProcessRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: Process): Promise<Process> {
    const result = await this.pool.query(
      `INSERT INTO processes (id, version, status, title, description, steps, provenance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${PROCESS_COLUMNS}`,
      [
        input.id,
        input.version,
        input.status,
        input.title,
        input.description,
        JSON.stringify(input.steps),
        JSON.stringify(input.provenance),
      ],
    )
    return mapProcess(result.rows[0])
  }

  async findById(id: string): Promise<Process | null> {
    const result = await this.pool.query(`SELECT ${PROCESS_COLUMNS} FROM processes WHERE id = $1`, [
      id,
    ])
    return maxVersion(result.rows.map(mapProcess))
  }

  async findLatestById(id: string): Promise<Process | null> {
    return this.findById(id)
  }

  async listByIdentity(id: string): Promise<Process[]> {
    const result = await this.pool.query(
      `SELECT ${PROCESS_COLUMNS} FROM processes WHERE id = $1 ORDER BY version ASC`,
      [id],
    )
    return result.rows.map(mapProcess)
  }

  async list(): Promise<Process[]> {
    const result = await this.pool.query(
      `SELECT ${PROCESS_COLUMNS} FROM processes ORDER BY title ASC`,
    )
    return result.rows.map(mapProcess)
  }

  async updateStatus(id: string, status: ProcessStatus): Promise<void> {
    await this.pool.query(`UPDATE processes SET status = $2 WHERE id = $1`, [id, status])
  }
}

export class PostgresIslandRepository implements IslandRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: Island): Promise<Island> {
    const result = await this.pool.query(
      `INSERT INTO islands
         (id, version, status, name, description, capabilities, runtime, permissions, provenance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${ISLAND_COLUMNS}`,
      [
        input.id,
        input.version,
        input.status,
        input.name,
        input.description,
        JSON.stringify(input.capabilities),
        JSON.stringify(input.runtime),
        JSON.stringify(input.permissions),
        JSON.stringify(input.provenance),
      ],
    )
    return mapIsland(result.rows[0])
  }

  async findById(id: string): Promise<Island | null> {
    const result = await this.pool.query(`SELECT ${ISLAND_COLUMNS} FROM islands WHERE id = $1`, [
      id,
    ])
    return maxVersion(result.rows.map(mapIsland))
  }

  async findLatestById(id: string): Promise<Island | null> {
    return this.findById(id)
  }

  async listByIdentity(id: string): Promise<Island[]> {
    const result = await this.pool.query(
      `SELECT ${ISLAND_COLUMNS} FROM islands WHERE id = $1 ORDER BY version ASC`,
      [id],
    )
    return result.rows.map(mapIsland)
  }

  async list(): Promise<Island[]> {
    const result = await this.pool.query(`SELECT ${ISLAND_COLUMNS} FROM islands ORDER BY name ASC`)
    return result.rows.map(mapIsland)
  }

  async listActive(): Promise<Island[]> {
    const result = await this.pool.query(
      `SELECT ${ISLAND_COLUMNS} FROM islands WHERE status = 'active' ORDER BY name ASC`,
    )
    return result.rows.map(mapIsland)
  }

  async updateStatus(id: string, status: IslandStatus): Promise<void> {
    await this.pool.query(`UPDATE islands SET status = $2 WHERE id = $1`, [id, status])
  }
}

/** Pick the highest-version record (semver), independent of insert timing. */
function maxVersion<T extends { version: string }>(records: T[]): T | null {
  if (records.length === 0) {
    return null
  }
  return records.reduce((max, record) =>
    compareVersions(record.version, max.version) > 0 ? record : max,
  )
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}
