import type {
  Knowledge,
  KnowledgeEvent,
  KnowledgeStatus,
  VersionProposal,
  VersionProposalEvent,
  VersionProposalStatus,
} from '@element-plus/contracts'
import { canTransition, nextState } from './state-machine'
import { isVersionGreater } from './version'

/**
 * Knowledge governance.
 *
 * Knowledge transitions draft → published → superseded. Published knowledge is
 * immutable: evolution happens by creating a new version and superseding the
 * prior one (never by editing in place).
 */

export const knowledgeTransitions: Record<
  KnowledgeStatus,
  Partial<Record<KnowledgeEvent, KnowledgeStatus>>
> = {
  draft: { publish: 'published', supersede: 'superseded' },
  published: { supersede: 'superseded' },
  superseded: {},
}

export function canKnowledgeTransition(from: KnowledgeStatus, event: KnowledgeEvent): boolean {
  return canTransition(knowledgeTransitions, from, event)
}

export function nextKnowledgeState(from: KnowledgeStatus, event: KnowledgeEvent): KnowledgeStatus {
  return nextState(knowledgeTransitions, from, event)
}

/**
 * VersionProposal lifecycle.
 *
 * There is no automatic canonical merge. A proposal moves draft → proposed →
 * under_review → approved → merged (or rejected at the review gates). Merging
 * requires approval and a strictly forward version.
 */

export const versionProposalTransitions: Record<
  VersionProposalStatus,
  Partial<Record<VersionProposalEvent, VersionProposalStatus>>
> = {
  draft: { propose: 'proposed' },
  proposed: { review: 'under_review', reject: 'rejected' },
  under_review: { approve: 'approved', reject: 'rejected' },
  approved: { merge: 'merged' },
  rejected: {},
  merged: {},
}

export function canProposalTransition(
  from: VersionProposalStatus,
  event: VersionProposalEvent,
): boolean {
  return canTransition(versionProposalTransitions, from, event)
}

export function nextProposalState(
  from: VersionProposalStatus,
  event: VersionProposalEvent,
): VersionProposalStatus {
  return nextState(versionProposalTransitions, from, event)
}

/** A proposal is forward: its target version must strictly increase. */
export function isForwardProposal(proposal: VersionProposal): boolean {
  return isVersionGreater(proposal.toVersion, proposal.fromVersion)
}

/**
 * A proposal may be merged only after approval and only when its version is
 * strictly forward. Rejected/merged proposals are terminal.
 */
export function canMergeProposal(proposal: VersionProposal): boolean {
  return proposal.status === 'approved' && isForwardProposal(proposal)
}

/**
 * The proposed target version must be the next patch after the current target
 * version (evolution is linear, never skipping or rewriting versions).
 */
export function isNextPatch(currentVersion: string, toVersion: string): boolean {
  const [major, minor, patch] = currentVersion.split('.').map(Number) as [number, number, number]
  return toVersion === `${major}.${minor}.${patch + 1}`
}

/** Structural validation of a knowledge record (title + content). */
export function validateKnowledge(knowledge: Knowledge): string[] {
  const errors: string[] = []
  if (knowledge.title.trim().length === 0) {
    errors.push('knowledge title must not be empty')
  }
  if (knowledge.content.trim().length === 0) {
    errors.push('knowledge content must not be empty')
  }
  return errors
}
