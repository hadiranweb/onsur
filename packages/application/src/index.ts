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
  ProblemRecord,
  ProblemSpecificationRecord,
  SpsSessionRecord,
  SpsMessageRecord,
  ProblemRepository,
  ProblemSpecificationRepository,
  SpsRepository,
  StructuredLlmPort,
  StructuredLlmRequest,
  RunRecord,
  RunEventRecord,
  ToolCallRecord,
  ToolCallStatus,
  ApprovalRecord,
  EffectRecordRow,
  ArtifactRecord,
  RunRepository,
  ApprovalRepository,
  ToolCallRepository,
  EffectRepository,
  ArtifactRepository,
  EvaluationRepository,
  ToolRegistry,
  RuntimeAdapter,
  RuntimeEvent,
  RuntimeError,
  RuntimeSession,
  ToolGate,
  ToolGateRequest,
  ToolGateResult,
} from './ports'

export { AuthService, SESSION_COOKIE_NAME, SESSION_TTL_MS } from './services/auth-service'
export type { AuthServiceDeps, AuthResult } from './services/auth-service'

export { WorkspaceService } from './services/workspace-service'
export type { WorkspaceAccess, WorkspaceServiceDeps } from './services/workspace-service'

export { FounderService } from './services/founder-service'
export type { FounderServiceDeps, FounderSessionView } from './services/founder-service'

export { CapabilityService } from './services/capability-service'
export type { CapabilityServiceDeps, RegisterCapabilityInput } from './services/capability-service'

export { ProcessService } from './services/process-service'
export type { ProcessServiceDeps, CreateProcessInput } from './services/process-service'

export { IslandService } from './services/island-service'
export type {
  IslandServiceDeps,
  CreateIslandInput,
  ResolveOrCreateResult,
} from './services/island-service'

export { RunEngine, normalizeError } from './services/run-engine'
export type { EnqueueRunInput, RunEngineDeps, RunView } from './services/run-engine'

export { FakeRuntimeAdapter } from './infrastructure/fake-runtime-adapter'
export type {
  FakeRuntimeAdapterOptions,
  FakeRuntimeScriptStep,
} from './infrastructure/fake-runtime-adapter'

export { InMemoryToolRegistry, DEFAULT_TOOL_CONTRACTS } from './infrastructure/tool-registry'

export {
  STRUCTURED_ANALYSIS_CAPABILITY,
  structuredAnalysisIslandManifest,
} from './reference-islands/structured-analysis'

export { makeProvenance } from './util/provenance'

export { FakeStructuredLlm, MalformedStructuredLlm } from './infrastructure/fake-structured-llm'

export { createPgPool } from './infrastructure/pg'
export { createPostgresRepositories } from './infrastructure/postgres-repositories'
export { PostgresUserRepository } from './infrastructure/postgres-repositories'
export { PostgresSessionRepository } from './infrastructure/postgres-repositories'
export { PostgresWorkspaceRepository } from './infrastructure/postgres-repositories'
export { PostgresMembershipRepository } from './infrastructure/postgres-repositories'
export { PostgresProblemRepository } from './infrastructure/postgres-repositories'
export { PostgresProblemSpecificationRepository } from './infrastructure/postgres-repositories'
export { PostgresSpsRepository } from './infrastructure/postgres-repositories'
export { PostgresCapabilityRepository } from './infrastructure/postgres-repositories'
export { PostgresProcessRepository } from './infrastructure/postgres-repositories'
export { PostgresIslandRepository } from './infrastructure/postgres-repositories'
export { PostgresRunRepository } from './infrastructure/postgres-repositories'
export { PostgresApprovalRepository } from './infrastructure/postgres-repositories'
export { PostgresToolCallRepository } from './infrastructure/postgres-repositories'
export { PostgresEffectRepository } from './infrastructure/postgres-repositories'
export { PostgresArtifactRepository } from './infrastructure/postgres-repositories'
export { PostgresEvaluationRepository } from './infrastructure/postgres-repositories'
export { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher'
export { HmacSessionCodec } from './infrastructure/session-codec'
export { readMigrations, runMigrations } from './infrastructure/migrate'
export type { Migration } from './infrastructure/migrate'

export { createAppServices } from './app'
export type { AppServices, AppServicesConfig } from './app'
