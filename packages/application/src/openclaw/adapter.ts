import type { RuntimeAdapter, RuntimeError, RuntimeEvent, RuntimeSession } from '../ports'
import { normalizeError } from '../util/normalize-error'
import { runOpenClawAgent } from './cli'
import type { OpenClawCliConfig } from './cli'
import { assertDistinctSessionKey, deriveOpenClawSessionKey } from './session-mapping'

export interface OpenClawAdapterOptions {
  cli: OpenClawCliConfig
}

/**
 * OpenClaw is a RuntimeAdapter — never Element Plus itself.
 *
 * The adapter executes an Element Plus Run through the documented `openclaw`
 * CLI, mapping:
 *  - run context  -> `--message-file` (ProblemSpecification rendered as text)
 *  - run id       -> a distinct `agent:<id>:element-plus-<runId>` session key
 *  - CLI stderr   -> `log` events
 *  - CLI JSON     -> `completed` / `failed` events (error normalization)
 *  - reply text   -> the result (memory suggestions stay candidates only)
 *
 * Authorization is NOT delegated to OpenClaw: the adapter never executes an
 * effectful tool itself. Any effectful tool the agent attempts inside OpenClaw
 * is subject to OpenClaw's own default-deny exec policy, and the Element Plus
 * ToolGate remains the only path to effect execution. OpenClaw permissions can
 * never expand Element Plus authority.
 */
export class OpenClawRuntimeAdapter implements RuntimeAdapter {
  readonly kind = 'openclaw' as const

  constructor(private readonly options: OpenClawAdapterOptions) {}

  async *start(session: RuntimeSession): AsyncIterable<RuntimeEvent> {
    yield { type: 'started' }

    const sessionKey = deriveOpenClawSessionKey({
      agentId: this.options.cli.agentId,
      runId: session.runId,
    })

    const violation = assertDistinctSessionKey(session.runId, sessionKey)
    if (violation) {
      yield { type: 'failed', error: { code: 'SESSION_MAPPING_ERROR', message: violation } }
      return
    }

    const message = renderContext(session)

    const result = await runOpenClawAgent(this.options.cli, {
      sessionKey,
      message,
      signal: session.signal,
      onStderr: () => undefined,
    })

    if (!result.ok) {
      yield { type: 'failed', error: result.error }
      return
    }

    yield {
      type: 'completed',
      result: {
        summary: result.text,
        openClawSessionKey: sessionKey,
        meta: result.meta,
        // Memory output remains a *candidate* only; it never mutates canonical
        // memory or knowledge. Promotion is governed in Sprint 07+.
        memoryCandidates: classifyMemoryCandidates(result.text),
      },
    }
  }
}

/** Render the run context into the message passed to OpenClaw. */
export function renderContext(session: RuntimeSession): string {
  const spec = session.problemSpec
  const lines: string[] = []
  lines.push('# Task')
  lines.push(spec.structuredUnderstanding)
  lines.push('')
  lines.push('## Raw problem (verbatim)')
  lines.push(spec.rawProblem)
  lines.push('')
  lines.push('## Evidence / assumptions / unknowns')
  for (const item of spec.items) {
    lines.push(`- [${item.kind}] ${item.text}`)
  }
  lines.push('')
  lines.push('## Success criteria')
  for (const criterion of spec.successCriteria) {
    lines.push(`- ${criterion}`)
  }
  if (spec.constraints.length > 0) {
    lines.push('')
    lines.push('## Constraints')
    for (const constraint of spec.constraints) {
      lines.push(`- ${constraint}`)
    }
  }
  lines.push('')
  lines.push(
    'Analyze the problem and produce a structured answer. Do not perform any ' +
      'external action; effectful steps require approval outside this runtime. ' +
      'If you have a durable insight, put it under a "## Memory" section.',
  )
  return lines.join('\n')
}

const MEMORY_SECTION_RE = /(?:^|\n)\s*#+\s*memory\s*\n([\s\S]*?)(?=\n\s*#+\s|$)/i

/**
 * Extract memory suggestions from an OpenClaw reply as candidates only.
 * The prompt we send asks OpenClaw to place any memory suggestion under a
 * "Memory" section; the adapter surfaces that section as candidates without
 * ever writing to canonical memory or knowledge.
 */
export function classifyMemoryCandidates(reply: string): string[] {
  const match = MEMORY_SECTION_RE.exec(reply)
  if (!match || !match[1]) {
    return []
  }
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean)
}

export function normalizeOpenClawError(error: unknown): RuntimeError {
  return normalizeError(error)
}
