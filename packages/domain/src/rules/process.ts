import type {
  Process,
  ProcessEvent,
  ProcessStatus,
  ProcessStep,
  ProcessStepEvent,
  ProcessStepStatus,
} from '@element-plus/contracts'
import { canTransition, nextState } from './state-machine'

/**
 * Process and ProcessStep lifecycles, plus structural Process validation.
 */

export const processTransitions: Record<
  ProcessStatus,
  Partial<Record<ProcessEvent, ProcessStatus>>
> = {
  draft: { validate: 'validated', publish: 'published' },
  validated: { publish: 'published', supersede: 'superseded' },
  published: { supersede: 'superseded' },
  superseded: {},
}

export function canProcessTransition(from: ProcessStatus, event: ProcessEvent): boolean {
  return canTransition(processTransitions, from, event)
}

export function nextProcessState(from: ProcessStatus, event: ProcessEvent): ProcessStatus {
  return nextState(processTransitions, from, event)
}

export const processStepTransitions: Record<
  ProcessStepStatus,
  Partial<Record<ProcessStepEvent, ProcessStepStatus>>
> = {
  pending: { ready: 'ready', skip: 'skipped' },
  ready: { run: 'running', skip: 'skipped' },
  running: { complete: 'completed', fail: 'failed' },
  completed: {},
  failed: {},
  skipped: {},
}

export function canProcessStepTransition(
  from: ProcessStepStatus,
  event: ProcessStepEvent,
): boolean {
  return canTransition(processStepTransitions, from, event)
}

export function nextProcessStepState(
  from: ProcessStepStatus,
  event: ProcessStepEvent,
): ProcessStepStatus {
  return nextState(processStepTransitions, from, event)
}

/**
 * Structural Process-step validation: step ids must be unique, step orders must
 * be unique, and every `dependsOn` reference must point at a step within the
 * same Process. Returns a list of violations (empty means valid).
 */
export function validateProcessSteps(steps: readonly ProcessStep[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const orders = new Set<number>()

  for (const step of steps) {
    if (ids.has(step.id)) {
      errors.push(`duplicate step id "${step.id}"`)
    }
    ids.add(step.id)

    if (orders.has(step.order)) {
      errors.push(`duplicate step order ${step.order}`)
    }
    orders.add(step.order)
  }

  for (const step of steps) {
    for (const dependency of step.dependsOn) {
      if (!ids.has(dependency)) {
        errors.push(`step "${step.id}" depends on unknown step "${dependency}"`)
      }
    }
  }

  return errors
}

/** Structural Process validation over the whole Process (delegates to steps). */
export function validateProcess(process: Process): string[] {
  return validateProcessSteps(process.steps)
}
