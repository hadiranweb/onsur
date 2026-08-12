import type { WorkspaceRole } from '@element-plus/contracts'
import type {
  MembershipRecord,
  MembershipRepository,
  PasswordHasher,
  SessionCodec,
  SessionRecord,
  SessionRepository,
  UserRecord,
  UserRepository,
  WorkspaceRecord,
  WorkspaceRepository,
} from '../ports'
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
