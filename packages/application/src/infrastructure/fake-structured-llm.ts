import type { ProblemItem, StructuredProblemOutput } from '@element-plus/contracts'
import type { StructuredLlmPort, StructuredLlmRequest } from '../ports'

function truncate(value: string, max: number): string {
  const trimmed = value.trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`
}

/**
 * Deterministic fake structured LLM.
 *
 * Same input always produces the same output — no network, no randomness. It
 * demonstrably separates evidence / assumption / unknown and derives a single
 * success criterion. Used in tests and as the default dev provider until a
 * real model provider is integrated (do not treat this as "AI").
 */
export class FakeStructuredLlm implements StructuredLlmPort {
  async structure(request: StructuredLlmRequest): Promise<StructuredProblemOutput> {
    const { rawProblem, corrections } = request

    const items: ProblemItem[] = [
      { kind: 'evidence', text: `The user reported: ${truncate(rawProblem, 500)}` },
    ]
    if (corrections.length > 0) {
      items.push({
        kind: 'assumption',
        text: `Corrections applied: ${truncate(corrections.join('; '), 500)}`,
      })
    } else {
      items.push({ kind: 'assumption', text: 'Operating conditions are assumed to be nominal.' })
    }
    items.push({ kind: 'unknown', text: 'Root cause is unknown pending further analysis.' })

    const structuredUnderstanding =
      corrections.length > 0
        ? `Structured understanding (revised per corrections): ${rawProblem}. Corrections: ${corrections.join('; ')}.`
        : `Structured understanding: ${rawProblem}.`

    return {
      structuredUnderstanding,
      items,
      successCriteria: [`A solution that addresses: ${truncate(rawProblem, 120)}`],
      constraints: ['No irreversible external effect without explicit approval.'],
    }
  }
}

/**
 * A fake LLM that returns malformed output, used to prove that model output is
 * schema-validated before it can become a ProblemSpecification.
 */
export class MalformedStructuredLlm implements StructuredLlmPort {
  async structure(_request: StructuredLlmRequest): Promise<StructuredProblemOutput> {
    // Missing structuredUnderstanding, items, successCriteria.
    return {} as unknown as StructuredProblemOutput
  }
}
