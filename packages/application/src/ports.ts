import type { WorkspaceRole } from '@element-plus/contracts'

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
