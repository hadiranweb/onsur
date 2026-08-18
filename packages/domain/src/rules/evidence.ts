import type { Evidence, EvidenceEvent, EvidenceStatus } from '@element-plus/contracts'
import { canTransition, nextState } from './state-machine'

/**
 * Evidence quality gate.
 *
 * Evidence enters at `intake`, is submitted for review (only if it passes the
 * quality gate), and is either accepted or rejected. Rejected evidence is
 * terminal: it can never promote to accepted. Duplicates are detected by exact
 * content fingerprint and by approximate (normalized) similarity.
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

// ---------------------------------------------------------------------------
// Approximate duplicate detection (deterministic, provider-free)
// ---------------------------------------------------------------------------

const STRIP_RE = /[^\p{L}\p{N}\s]/gu

/** Lowercase, strip punctuation, collapse whitespace. Preserves Persian. */
export function normalizeForComparison(text: string): string {
  return text.toLowerCase().replace(STRIP_RE, ' ').replace(/\s+/g, ' ').trim()
}

export function tokenize(text: string): string[] {
  const normalized = normalizeForComparison(text)
  return normalized.length === 0 ? [] : normalized.split(' ')
}

/** Jaccard similarity over normalized word tokens (0..1). */
export function jaccardSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  if (tokensA.length === 0 && tokensB.length === 0) {
    return 1
  }
  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0
  }
  const setA = new Set(tokensA)
  const setB = new Set(tokensB)
  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1
    }
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/** Approximate duplicate when normalized similarity meets `threshold`. */
export function isApproximateDuplicate(a: string, b: string, threshold = 0.8): boolean {
  return jaccardSimilarity(a, b) >= threshold
}

// ---------------------------------------------------------------------------
// Quality gate
// ---------------------------------------------------------------------------

export interface EvidenceQualityReport {
  passed: boolean
  issues: string[]
}

export const MIN_EVIDENCE_CONTENT_LENGTH = 10

/** The quality gate: evidence must be substantive and carry a fingerprint. */
export function evaluateEvidenceQuality(input: {
  content: string
  fingerprint: string
}): EvidenceQualityReport {
  const issues: string[] = []
  if (input.content.trim().length < MIN_EVIDENCE_CONTENT_LENGTH) {
    issues.push(`content must be at least ${MIN_EVIDENCE_CONTENT_LENGTH} characters`)
  }
  if (input.fingerprint.trim().length === 0) {
    issues.push('fingerprint must not be empty')
  }
  return { passed: issues.length === 0, issues }
}
