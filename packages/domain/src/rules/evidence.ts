import type { Evidence, EvidenceEvent, EvidenceStatus } from '@element-plus/contracts'
import { canTransition, nextState } from './state-machine'

/**
 * Evidence quality gate.
 *
 * Evidence enters at `intake`, is submitted for review, and is either accepted
 * or rejected. Rejected evidence is terminal: it can never promote to
 * accepted. Exact duplicates are detected by content fingerprint.
 */

export const evidenceTransitions: Record<
  EvidenceStatus,
  Partial<Record<EvidenceEvent, EvidenceStatus>>
> = {
  intake: { submit: 'pending_review' },
  pending_review: { accept: 'accepted', reject: 'rejected' },
  accepted: {},
  rejected: {},
}

export function canEvidenceTransition(from: EvidenceStatus, event: EvidenceEvent): boolean {
  return canTransition(evidenceTransitions, from, event)
}

export function nextEvidenceState(from: EvidenceStatus, event: EvidenceEvent): EvidenceStatus {
  return nextState(evidenceTransitions, from, event)
}

/** Exact fingerprint duplicate detection. */
export function isExactDuplicate(a: Evidence, b: Evidence): boolean {
  return a.fingerprint === b.fingerprint
}

/** Returns the evidence items that are exact duplicates of `candidate`. */
export function findExactDuplicates(
  candidate: Evidence,
  existing: readonly Evidence[],
): Evidence[] {
  return existing.filter((item) => item.id !== candidate.id && isExactDuplicate(candidate, item))
}
