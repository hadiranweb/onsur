import { randomUUID } from 'node:crypto'
import { isSessionActive, validatePassword } from '@element-plus/domain'
import type { LoginInput, RegisterInput } from '@element-plus/contracts'
import { AppError } from '../errors'
import type {
  PasswordHasher,
  SessionCodec,
  SessionRecord,
  SessionRepository,
  UserRecord,
  UserRepository,
} from '../ports'
import type { WorkspaceService } from './workspace-service'

export const SESSION_COOKIE_NAME = 'element_plus_session'

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface AuthServiceDeps {
  users: UserRepository
  sessions: SessionRepository
  hasher: PasswordHasher
  codec: SessionCodec
  workspaces: WorkspaceService
  now?: () => Date
}

export interface AuthResult {
  user: UserRecord
  cookieValue: string
}

export class AuthService {
  private readonly now: () => Date

  constructor(private readonly deps: AuthServiceDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email)
    const issues = validatePassword(input.password)
    if (issues.length > 0) {
      throw new AppError('INVALID_INPUT', issues.join('; '))
    }

    const existing = await this.deps.users.findByEmail(email)
    if (existing) {
      throw new AppError('EMAIL_TAKEN', 'an account with this email already exists')
    }

    const passwordHash = await this.deps.hasher.hash(input.password)
    const user = await this.deps.users.create({
      id: randomUUID(),
      email,
      passwordHash,
      displayName: input.displayName,
    })

    await this.deps.workspaces.createPersonalWorkspace(user)

    const session = await this.issueSession(user.id)
    return { user, cookieValue: session.cookieValue }
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.deps.users.findByEmail(normalizeEmail(input.email))
    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', 'invalid email or password')
    }
    const ok = await this.deps.hasher.verify(input.password, user.passwordHash)
    if (!ok) {
      throw new AppError('INVALID_CREDENTIALS', 'invalid email or password')
    }
    const session = await this.issueSession(user.id)
    return { user, cookieValue: session.cookieValue }
  }

  /** Revoke the caller's current session (logout). Idempotent. */
  async logout(cookieValue: string | null | undefined): Promise<void> {
    const tokenHash = this.deps.codec.parse(cookieValue)
    if (!tokenHash) {
      return
    }
    const session = await this.deps.sessions.findByTokenHash(tokenHash)
    if (!session) {
      return
    }
    await this.deps.sessions.revoke(session.id)
  }

  /** Revoke every session belonging to a user. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.deps.sessions.revokeAllForUser(userId)
  }

  /** Resolve a signed cookie value to an active user, or null. */
  async getUserForCookie(cookieValue: string | null | undefined): Promise<UserRecord | null> {
    const tokenHash = this.deps.codec.parse(cookieValue)
    if (!tokenHash) {
      return null
    }
    const session = await this.deps.sessions.findByTokenHash(tokenHash)
    if (!session || !isSessionActive(session, this.now())) {
      return null
    }
    return this.deps.users.findById(session.userId)
  }

  private async issueSession(
    userId: string,
  ): Promise<{ cookieValue: string; session: SessionRecord }> {
    const { cookieValue, tokenHash } = this.deps.codec.create()
    const session = await this.deps.sessions.create({
      id: randomUUID(),
      userId,
      tokenHash,
      expiresAt: new Date(this.now().getTime() + SESSION_TTL_MS).toISOString(),
    })
    return { cookieValue, session }
  }
}

/**
 * Emails are identity keys; normalize them here so case and stray whitespace
 * cannot produce duplicate accounts, independent of boundary validation.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
