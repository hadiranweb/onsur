import type { RunEventType, RunStatus } from '@element-plus/contracts'
import { canTransition, nextState } from './state-machine'

/**
 * Run lifecycle.
 *
 * A Run advances from draft → queued → running. While running, an agent may
 * request approval for an irreversible effect, which moves the Run into
 * `awaiting_approval`; rejection resumes the Run *without* executing the tool,
 * and the decision is recorded on the RunEvent timeline.
 */

export const runTransitions: Record<RunStatus, Partial<Record<RunEventType, RunStatus>>> = {
  draft: { enqueue: 'queued', cancel: 'cancelled' },
  queued: { start: 'running', cancel: 'cancelled' },
  running: {
    request_approval: 'awaiting_approval',
    complete: 'completed',
    fail: 'failed',
    cancel: 'cancelled',
  },
  awaiting_approval: {
    approve: 'running',
    reject: 'running',
    cancel: 'cancelled',
  },
  completed: {},
  failed: {},
  cancelled: {},
}

export const terminalRunStatuses: readonly RunStatus[] = ['completed', 'failed', 'cancelled']

export function isTerminalRunStatus(status: RunStatus): boolean {
  return terminalRunStatuses.includes(status)
}

export function canRunTransition(from: RunStatus, event: RunEventType): boolean {
  return canTransition(runTransitions, from, event)
}

export function nextRunState(from: RunStatus, event: RunEventType): RunStatus {
  return nextState(runTransitions, from, event)
}
