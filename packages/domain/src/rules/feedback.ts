import type { FeedbackEvent, FeedbackStatus } from '@element-plus/contracts'
import { canTransition, nextState } from './state-machine'

/**
 * Feedback lifecycle.
 *
 * Feedback is submitted against a Run, triaged, then accepted or rejected.
 * Accepted feedback may be applied (e.g. to support a MemoryCandidate or a
 * VersionProposal). Rejected and applied are terminal.
 */

export const feedbackTransitions: Record<
  FeedbackStatus,
  Partial<Record<FeedbackEvent, FeedbackStatus>>
> = {
  submitted: { triage: 'triaged' },
  triaged: { accept: 'accepted', reject: 'rejected' },
  accepted: { apply: 'applied' },
  rejected: {},
  applied: {},
}

export function canFeedbackTransition(from: FeedbackStatus, event: FeedbackEvent): boolean {
  return canTransition(feedbackTransitions, from, event)
}

export function nextFeedbackState(from: FeedbackStatus, event: FeedbackEvent): FeedbackStatus {
  return nextState(feedbackTransitions, from, event)
}
