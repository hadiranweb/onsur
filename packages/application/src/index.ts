/**
 * @element-plus/application
 *
 * Application services / orchestration for Element Plus (عنصر پلاس).
 *
 * Sprint 02 adds real identity and workspace use cases on top of the canonical
 * contracts and pure domain rules.
 */
export { AppError, UniqueViolationError } from './errors'
export type { AppErrorCode } from './errors'

export type {
  UserRecord,
  SessionRecord,
  WorkspaceRecord,
  MembershipRecord,
  UserRepository,
  SessionRepository,
  WorkspaceRepository,
  MembershipRepository,
  PasswordHasher,
  SessionCodec,
} from './ports'

export { AuthService, SESSION_COOKIE_NAME, SESSION_TTL_MS } from './services/auth-service'
export type { AuthServiceDeps, AuthResult } from './services/auth-service'

export { WorkspaceService } from './services/workspace-service'
export type { WorkspaceAccess, WorkspaceServiceDeps } from './services/workspace-service'

export { createPgPool } from './infrastructure/pg'
export { createPostgresRepositories } from './infrastructure/postgres-repositories'
export { PostgresUserRepository } from './infrastructure/postgres-repositories'
export { PostgresSessionRepository } from './infrastructure/postgres-repositories'
export { PostgresWorkspaceRepository } from './infrastructure/postgres-repositories'
export { PostgresMembershipRepository } from './infrastructure/postgres-repositories'
export { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher'
export { HmacSessionCodec } from './infrastructure/session-codec'
export { readMigrations, runMigrations } from './infrastructure/migrate'
export type { Migration } from './infrastructure/migrate'

export { createAppServices } from './app'
export type { AppServices, AppServicesConfig } from './app'
