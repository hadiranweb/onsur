/**
 * @element-plus/contracts
 *
 * Canonical Zod schemas for Element Plus (عنصر پلاس): the executable form of
 * the canonical domain language.
 */
export { idSchema, entityKindSchema, referenceSchema, versionSchema, timestampSchema } from './ids'
export type { Id, EntityKind, Reference, Version, Timestamp } from './ids'

export { provenanceSchema, provenanceSourceSchema } from './provenance'
export type { Provenance, ProvenanceSource } from './provenance'

export {
  problemSpecificationSchema,
  problemItemSchema,
  problemStatusSchema,
  evidenceKindSchema,
} from './problem'
export type { ProblemSpecification, ProblemItem, ProblemStatus, EvidenceKind } from './problem'

export {
  spsStatusSchema,
  spsEventSchema,
  spsMessageRoleSchema,
  spsMessageSchema,
  spsSessionSchema,
  structuredProblemOutputSchema,
} from './sps'
export type {
  SpsStatus,
  SpsEvent,
  SpsMessageRole,
  SpsMessage,
  SpsSession,
  StructuredProblemOutput,
} from './sps'

export { evidenceSchema, evidenceStatusSchema, evidenceEventSchema } from './evidence'
export type { Evidence, EvidenceStatus, EvidenceEvent } from './evidence'
export { capabilitySchema } from './capability'
export type { Capability } from './capability'

export {
  processSchema,
  processStepSchema,
  processStatusSchema,
  processEventSchema,
  processStepStatusSchema,
  processStepEventSchema,
} from './process'
export type {
  Process,
  ProcessStep,
  ProcessStatus,
  ProcessEvent,
  ProcessStepStatus,
  ProcessStepEvent,
} from './process'

export {
  islandSchema,
  islandManifestSchema,
  runtimeBindingSchema,
  runtimeKindSchema,
  islandStatusSchema,
  islandEventSchema,
} from './island'
export type {
  Island,
  IslandManifest,
  RuntimeBinding,
  RuntimeKind,
  IslandStatus,
  IslandEvent,
} from './island'

export { agentSchema, agentRoleSchema } from './agent'
export type { Agent, AgentRole } from './agent'

export { toolContractSchema, toolCallSchema, effectRecordSchema, effectKindSchema } from './tool'
export type { ToolContract, ToolCall, EffectRecord, EffectKind } from './tool'

export {
  packageEnvelopeSchema,
  packageKindSchema,
  packageDeliveryStatusSchema,
  connectorStatusSchema,
} from './package'
export type {
  PackageEnvelope,
  PackageKind,
  PackageDeliveryStatus,
  ConnectorStatus,
} from './package'

export {
  runSchema,
  runSnapshotSchema,
  runEventSchema,
  runStatusSchema,
  runEventTypeSchema,
  artifactSchema,
  artifactKindSchema,
} from './run'
export type {
  Run,
  RunSnapshot,
  RunEvent,
  RunStatus,
  RunEventType,
  Artifact,
  ArtifactKind,
} from './run'

export {
  evaluationSchema,
  evaluationCriterionSchema,
  evaluationVerdictSchema,
  feedbackSchema,
  feedbackStatusSchema,
  feedbackEventSchema,
} from './evaluation'
export type {
  Evaluation,
  EvaluationCriterion,
  EvaluationVerdict,
  Feedback,
  FeedbackStatus,
  FeedbackEvent,
} from './evaluation'

export { memoryEntrySchema, memoryScopeSchema, memoryStatusSchema } from './memory'
export type { MemoryEntry, MemoryScope, MemoryStatus } from './memory'

export {
  knowledgeSchema,
  knowledgeStatusSchema,
  knowledgeEventSchema,
  versionProposalSchema,
  versionProposalStatusSchema,
  versionProposalEventSchema,
} from './knowledge'
export type {
  Knowledge,
  KnowledgeStatus,
  KnowledgeEvent,
  VersionProposal,
  VersionProposalStatus,
  VersionProposalEvent,
} from './knowledge'

export { assetSchema, assetKindSchema, assetVisibilitySchema, assetInstallSchema } from './asset'
export type { Asset, AssetKind, AssetVisibility, AssetInstall } from './asset'

export { auditEventSchema, auditOutcomeSchema } from './audit'
export type { AuditEvent, AuditOutcome } from './audit'

export { approvalSchema, approvalStatusSchema } from './approval'
export type { Approval, ApprovalStatus } from './approval'

export {
  emailSchema,
  passwordSchema,
  displayNameSchema,
  registerInputSchema,
  loginInputSchema,
  workspaceRoleSchema,
  workspaceKindSchema,
  userSchema,
  publicUserSchema,
  sessionSchema,
  workspaceSchema,
  membershipSchema,
  createWorkspaceInputSchema,
} from './identity'
export type {
  Email,
  RegisterInput,
  LoginInput,
  WorkspaceRole,
  WorkspaceKind,
  User,
  PublicUser,
  Session,
  Workspace,
  Membership,
  CreateWorkspaceInput,
} from './identity'

export { envSchema, parseEnv, getEnv } from './env'
export type { Env, EnvResult } from './env'
