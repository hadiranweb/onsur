import type { SpsEvent, SpsStatus } from '@element-plus/contracts'
import { canTransition, nextState } from './state-machine'

/**
 * Structured Problem Solving (SPS) lifecycle — deterministic.
 *
 *   open --submit--> structuring --produced--> review --confirm--> confirmed
 *                       ^  |                      |
 *                       |  +--fail--> open        +--correct--> structuring
 *
 * `confirmed` is terminal: once a ProblemSpecification is confirmed it is a
 * versioned, published object and is never silently mutated (corrections would
 * start a new session or a new proposal, not rewrite the confirmed version).
 */
export const spsTransitions: Record<SpsStatus, Partial<Record<SpsEvent, SpsStatus>>> = {
  open: { submit: 'structuring' },
  structuring: { produced: 'review', fail: 'open' },
  review: { confirm: 'confirmed', correct: 'structuring' },
  confirmed: {},
}

export function canSpsTransition(from: SpsStatus, event: SpsEvent): boolean {
  return canTransition(spsTransitions, from, event)
}

export function nextSpsState(from: SpsStatus, event: SpsEvent): SpsStatus {
  return nextState(spsTransitions, from, event)
}
