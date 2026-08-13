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
  EvidenceRecord,
  EvidenceRepository,
  FeedbackRecord,
  FeedbackRepository,
  MemoryRecord,
  MemoryRepository,
  KnowledgeRecord,
  KnowledgeRepository,
  VersionProposalRecord,
  VersionProposalRepository,
  OutboxMessageRecord,
  OutboxRepository,
  TransactionalScope,
  TransactionRunner,
  Connector,
  PackageEventRecord,
  PackageEventRepository,
  AssetRecord,
  AssetRepository,
  AssetInstallRecord,
  AssetInstallRepository,
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

export {
  RunEngine,
  normalizeError,
  extractMemoryCandidates,
  parseFakeScript,
} from './services/run-engine'
export type {
  EnqueueRunInput,
  RunEngineDeps,
  RunView,
  RunMemoryIntake,
} from './services/run-engine'

export { ResourceAccessService } from './services/resource-access-service'
export type { ResourceAccessDeps } from './services/resource-access-service'

export { EvidenceService } from './services/evidence-service'
export type { EvidenceServiceDeps, IntakeEvidenceInput } from './services/evidence-service'

export { FeedbackService } from './services/feedback-service'
export type { FeedbackServiceDeps, SubmitFeedbackInput } from './services/feedback-service'

export { MemoryService } from './services/memory-service'
export type { MemoryServiceDeps } from './services/memory-service'

export { KnowledgeService } from './services/knowledge-service'
export type { KnowledgeServiceDeps, CreateKnowledgeInput } from './services/knowledge-service'

export { VersionProposalService } from './services/version-proposal-service'
export type {
  VersionProposalServiceDeps,
  ProposeVersionInput,
} from './services/version-proposal-service'

export { PackageService } from './services/package-service'
export type { PackageServiceDeps, PublishPackageInput } from './services/package-service'

export { AssetService } from './services/asset-service'
export type { AssetServiceDeps, RegisterAssetInput, ForkResult } from './services/asset-service'

export {
  PgOutboxRepository,
  PgPackageEventRepository,
  PgTransactionRunner,
} from './infrastructure/outbox'
export { RelayConnector } from './infrastructure/relay-connector'

export {
  PostgresAssetRepository,
  PostgresAssetInstallRepository,
} from './infrastructure/postgres-repositories'

export { fingerprintContent } from './util/fingerprint'

export { logger } from './util/logger'

export { FakeRuntimeAdapter } from './infrastructure/fake-runtime-adapter'
export type {
  FakeRuntimeAdapterOptions,
  FakeRuntimeScriptStep,
} from './infrastructure/fake-runtime-adapter'

export { InMemoryToolRegistry, DEFAULT_TOOL_CONTRACTS } from './infrastructure/tool-registry'

export { OpenClawRuntimeAdapter, renderContext, classifyMemoryCandidates } from './openclaw/adapter'
export type { OpenClawAdapterOptions } from './openclaw/adapter'
export { runOpenClawAgent } from './openclaw/cli'
export type { OpenClawCliConfig, OpenClawRunResult, OpenClawAgentJson } from './openclaw/cli'
export {
  deriveOpenClawSessionKey,
  isElementPlusSessionKey,
  assertDistinctSessionKey,
} from './openclaw/session-mapping'
export { checkOpenClawHealth } from './openclaw/health'
export type { OpenClawHealthStatus, OpenClawHealthResult } from './openclaw/health'

export {
  STRUCTURED_ANALYSIS_CAPABILITY,
  structuredAnalysisIslandManifest,
} from './reference-islands/structured-analysis'

export {
  CONTROLLED_ACTION_CAPABILITY,
  controlledActionIslandManifest,
} from './reference-islands/controlled-action'

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
export { PostgresEvidenceRepository } from './infrastructure/postgres-repositories'
export { PostgresFeedbackRepository } from './infrastructure/postgres-repositories'
export { PostgresMemoryRepository } from './infrastructure/postgres-repositories'
export { PostgresKnowledgeRepository } from './infrastructure/postgres-repositories'
export { PostgresVersionProposalRepository } from './infrastructure/postgres-repositories'
export { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher'
export { HmacSessionCodec } from './infrastructure/session-codec'
export { readMigrations, runMigrations } from './infrastructure/migrate'
export type { Migration } from './infrastructure/migrate'

export { createAppServices } from './app'
export type { AppServices, AppServicesConfig } from './app'
