import { describe, expect, it } from 'vitest'
import {
  canEvidenceTransition,
  canFeedbackTransition,
  canIslandTransition,
  canProcessStepTransition,
  canProposalTransition,
  canRunTransition,
  nextEvidenceState,
  nextFeedbackState,
  nextIslandState,
  nextProcessState,
  nextProcessStepState,
  nextProposalState,
  nextRunState,
} from '../index'

describe('run lifecycle', () => {
  it('advances draft -> queued -> running -> completed', () => {
    expect(nextRunState('draft', 'enqueue')).toBe('queued')
    expect(nextRunState('queued', 'start')).toBe('running')
    expect(nextRunState('running', 'complete')).toBe('completed')
  })

  it('pauses for approval and resumes on rejection without completing', () => {
    expect(nextRunState('running', 'request_approval')).toBe('awaiting_approval')
    expect(nextRunState('awaiting_approval', 'reject')).toBe('running')
    expect(nextRunState('awaiting_approval', 'approve')).toBe('running')
  })

  it('treats completed, failed, cancelled as terminal', () => {
    for (const terminal of ['completed', 'failed', 'cancelled'] as const) {
      expect(canRunTransition(terminal, 'cancel')).toBe(false)
      expect(() => nextRunState(terminal, 'cancel')).toThrow()
    }
  })

  it('rejects illegal transitions', () => {
    expect(canRunTransition('draft', 'complete')).toBe(false)
    expect(() => nextRunState('queued', 'complete')).toThrow()
    expect(() => nextRunState('running', 'enqueue')).toThrow()
  })
})

describe('island lifecycle', () => {
  it('advances draft -> candidate -> active -> retired', () => {
    expect(nextIslandState('draft', 'propose')).toBe('candidate')
    expect(nextIslandState('candidate', 'activate')).toBe('active')
    expect(nextIslandState('active', 'retire')).toBe('retired')
  })

  it('allows a rejected candidate to return to draft', () => {
    expect(nextIslandState('candidate', 'reject')).toBe('draft')
  })

  it('treats retired as terminal', () => {
    expect(canIslandTransition('retired', 'activate')).toBe(false)
    expect(() => nextIslandState('retired', 'activate')).toThrow()
  })
})

describe('process lifecycle', () => {
  it('advances draft -> validated -> published -> superseded', () => {
    expect(nextProcessState('draft', 'validate')).toBe('validated')
    expect(nextProcessState('validated', 'publish')).toBe('published')
    expect(nextProcessState('published', 'supersede')).toBe('superseded')
  })

  it('advances a step pending -> ready -> running -> completed', () => {
    expect(nextProcessStepState('pending', 'ready')).toBe('ready')
    expect(nextProcessStepState('ready', 'run')).toBe('running')
    expect(nextProcessStepState('running', 'complete')).toBe('completed')
  })

  it('treats completed, failed, skipped steps as terminal', () => {
    for (const terminal of ['completed', 'failed', 'skipped'] as const) {
      expect(canProcessStepTransition(terminal, 'run')).toBe(false)
    }
  })
})

describe('evidence quality gate', () => {
  it('advances intake -> pending_review -> accepted', () => {
    expect(nextEvidenceState('intake', 'submit')).toBe('pending_review')
    expect(nextEvidenceState('pending_review', 'accept')).toBe('accepted')
  })

  it('rejected evidence cannot promote', () => {
    expect(nextEvidenceState('pending_review', 'reject')).toBe('rejected')
    expect(canEvidenceTransition('rejected', 'accept')).toBe(false)
    expect(() => nextEvidenceState('rejected', 'accept')).toThrow()
  })
})

describe('feedback lifecycle', () => {
  it('advances submitted -> triaged -> accepted -> applied', () => {
    expect(nextFeedbackState('submitted', 'triage')).toBe('triaged')
    expect(nextFeedbackState('triaged', 'accept')).toBe('accepted')
    expect(nextFeedbackState('accepted', 'apply')).toBe('applied')
  })

  it('treats rejected and applied as terminal', () => {
    expect(canFeedbackTransition('rejected', 'accept')).toBe(false)
    expect(canFeedbackTransition('applied', 'apply')).toBe(false)
  })
})

describe('version proposal lifecycle', () => {
  it('advances draft -> proposed -> under_review -> approved -> merged', () => {
    expect(nextProposalState('draft', 'propose')).toBe('proposed')
    expect(nextProposalState('proposed', 'review')).toBe('under_review')
    expect(nextProposalState('under_review', 'approve')).toBe('approved')
    expect(nextProposalState('approved', 'merge')).toBe('merged')
  })

  it('can be rejected at review gates and is then terminal', () => {
    expect(nextProposalState('proposed', 'reject')).toBe('rejected')
    expect(canProposalTransition('rejected', 'approve')).toBe(false)
    expect(() => nextProposalState('rejected', 'merge')).toThrow()
  })
})
