/**
 * @element-plus/domain
 *
 * Pure domain rules for Element Plus (عنصر پلاس): lifecycle/state-transition
 * tables, version invariants, structural validation, and published-object
 * immutability semantics.
 *
 * This layer is free of Next.js, React, PostgreSQL drivers, OpenClaw, and
 * LLM/provider SDKs. It depends on `@element-plus/contracts` for *types only*
 * (enforced by the architecture test in `src/__tests__/architecture.test.ts`).
 */
export { canTransition, nextState } from './rules/state-machine'
export type { TransitionTable } from './rules/state-machine'

export {
  parseVersion,
  compareVersions,
  isVersionGreater,
  assertNewVersion,
  canPublishVersion,
  bumpPatch,
} from './rules/version'
export type { SemverTriple } from './rules/version'

export {
  deepFreeze,
  publishObject,
  assertMutable,
  mutateObject,
  isPublishedStatus,
} from './rules/immutability'

export {
  runTransitions,
  terminalRunStatuses,
  isTerminalRunStatus,
  canRunTransition,
  nextRunState,
} from './rules/run'

export {
  islandTransitions,
  canIslandTransition,
  nextIslandState,
  canActivateIsland,
  islandProvidesAll,
  islandMatchScore,
  resolveIsland,
} from './rules/island'
export type { IslandResolution } from './rules/island'

export {
  processTransitions,
  processStepTransitions,
  canProcessTransition,
  nextProcessState,
  canProcessStepTransition,
  nextProcessStepState,
  validateProcess,
  validateProcessSteps,
} from './rules/process'

export {
  evidenceTransitions,
  canEvidenceTransition,
  nextEvidenceState,
  isExactDuplicate,
  findExactDuplicates,
} from './rules/evidence'

export { feedbackTransitions, canFeedbackTransition, nextFeedbackState } from './rules/feedback'

export {
  versionProposalTransitions,
  canProposalTransition,
  nextProposalState,
  isForwardProposal,
  canMergeProposal,
} from './rules/knowledge'

export { roleAtLeast, canAccessWorkspace, isWorkspaceOwner } from './rules/workspace'
export type { MembershipLike } from './rules/workspace'

export { isSessionActive, validatePassword } from './rules/identity'
export type { SessionLike } from './rules/identity'

export { spsTransitions, canSpsTransition, nextSpsState } from './rules/sps'
