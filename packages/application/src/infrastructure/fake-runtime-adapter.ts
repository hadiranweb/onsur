import type { RuntimeAdapter, RuntimeEvent, RuntimeSession, ToolGate } from '../ports'

export interface FakeRuntimeScriptStep {
  toolId: string
  arguments: Record<string, unknown>
}

export interface FakeRuntimeAdapterOptions {
  script?: FakeRuntimeScriptStep[]
  gate: ToolGate
}

/**
 * The fake runtime adapter. It is deterministic and in-process; it exercises
 * the exact same ToolGate handshake a real adapter (OpenClaw) will use, so
 * approval semantics are proven independently of any external runtime.
 *
 * Every effectful tool goes through the gate; when the gate denies, the tool
 * is NOT executed and the decision is logged (the engine records it).
 */
export class FakeRuntimeAdapter implements RuntimeAdapter {
  readonly kind = 'fake' as const

  constructor(private readonly options: FakeRuntimeAdapterOptions) {}

  async *start(session: RuntimeSession): AsyncIterable<RuntimeEvent> {
    yield { type: 'started' }

    const script = this.options.script ?? defaultScript(session)
    for (const step of script) {
      const decision = await this.options.gate.request({
        toolId: step.toolId,
        arguments: step.arguments,
      })

      if (!decision.allowed) {
        yield {
          type: 'log',
          message: `tool "${step.toolId}" was not executed (${decision.reason ?? 'denied'})`,
        }
        if (decision.reason === 'cancelled') {
          return
        }
        continue
      }

      yield {
        type: 'tool_result',
        toolCallId: decision.toolCallId,
        result: { simulated: true, tool: step.toolId },
      }
    }

    yield {
      type: 'completed',
      result: {
        summary: 'completed',
        problemSpec: session.problemSpec.structuredUnderstanding,
      },
    }
  }
}

function defaultScript(session: RuntimeSession): FakeRuntimeScriptStep[] {
  return [
    {
      toolId: 'tool-analyze',
      arguments: { input: session.problemSpec.structuredUnderstanding },
    },
  ]
}
