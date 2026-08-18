/**
 * OpenClaw integration (Sprint 06).
 *
 * Grounded in the documented CLI surface of `openclaw@2026.7.1-2`
 * ("Multi-channel AI gateway with extensible messaging integrations"). No
 * undocumented endpoints are used:
 *
 *   openclaw agent [--message | --message-file <path>] [--session-key <key> |
 *     --session-id <id>] [--agent <id>] [--model <id>] [--local] [--json]
 *     [--timeout <seconds>] [--deliver]
 *
 *   openclaw health --json --timeout <ms> [--verbose]
 *
 * Session keys are `agent:<agent-id>:<key>` and are distinct from Element Plus
 * run ids (see session-mapping.ts). The adapter shells out to the CLI and
 * normalizes the documented JSON output into Element Plus RuntimeEvents.
 */

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RuntimeError } from '../ports'

export interface OpenClawCliConfig {
  /** Path to the `openclaw` binary. Defaults to OPENCLAW_BIN or "openclaw". */
  bin: string
  /** OpenClaw agent id (maps to `--agent <id>`). */
  agentId: string
  /** Default run timeout in seconds (`--timeout`). */
  timeoutSeconds: number
  /** Force embedded execution (`--local`). */
  local?: boolean
}

export type OpenClawRunResult =
  { ok: true; text: string; meta: Record<string, unknown> } | { ok: false; error: RuntimeError }

/**
 * The documented `openclaw agent --json` response fields (defensive subset).
 * Only fields documented in the CLI reference are read.
 */
export interface OpenClawAgentJson {
  status?: string
  payloads?: { text?: string; mediaUrl?: string | null }[]
  meta?: {
    durationMs?: number
    transport?: string
    fallbackFrom?: string
    fallbackReason?: string
  }
  error?: unknown
}

/**
 * Run one agent turn through the documented `openclaw agent` CLI and return a
 * normalized result. `onStderr` receives diagnostics as they stream (they map
 * to Element Plus `log` events). `signal` aborts the child process.
 */
export async function runOpenClawAgent(
  config: OpenClawCliConfig,
  input: {
    sessionKey: string
    message: string
    signal?: AbortSignal
    onStderr?: (line: string) => void
  },
): Promise<OpenClawRunResult> {
  if (!existsSync(config.bin) && config.bin !== 'openclaw') {
    return {
      ok: false,
      error: {
        code: 'OPENCLAW_NOT_CONFIGURED',
        message: `openclaw binary not found: ${config.bin}`,
      },
    }
  }

  // `--message-file` (documented) avoids shell quoting issues and preserves
  // multiline context.
  const dir = await mkdtemp(join(tmpdir(), 'element-plus-openclaw-'))
  const messageFile = join(dir, 'context.md')
  await writeFile(messageFile, input.message, 'utf8')

  const args = [
    'agent',
    '--agent',
    config.agentId,
    '--session-key',
    input.sessionKey,
    '--message-file',
    messageFile,
    '--timeout',
    String(config.timeoutSeconds),
    '--json',
  ]
  if (config.local) {
    args.push('--local')
  }

  const child = spawn(config.bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })

  let stdout = ''
  let stderr = ''
  const onAbort = () => {
    // Documented abort semantics: SIGTERM then (as a backstop) SIGKILL.
    child.kill('SIGTERM')
    const timer = setTimeout(() => child.kill('SIGKILL'), 2000)
    timer.unref()
  }
  if (input.signal) {
    if (input.signal.aborted) {
      onAbort()
    } else {
      input.signal.addEventListener('abort', onAbort, { once: true })
    }
  }

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk
  })
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) {
        input.onStderr?.(trimmed)
      }
    }
  })

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on('error', (error) => {
      // ENOENT: binary missing; surfaced by the existsSync guard above for
      // explicit paths, but a PATH-only `openclaw` may still fail here.
      resolve(null)
      input.onStderr?.(`openclaw spawn error: ${error.message}`)
    })
    child.on('close', (code) => resolve(code))
  })

  if (input.signal) {
    input.signal.removeEventListener('abort', onAbort)
  }
  await rm(dir, { recursive: true, force: true })

  if (input.signal?.aborted) {
    return { ok: false, error: { code: 'CANCELLED', message: 'run cancelled' } }
  }

  if (exitCode !== 0) {
    return {
      ok: false,
      error: {
        code: 'OPENCLAW_ERROR',
        message: stderr.trim() || `openclaw exited with code ${exitCode}`,
      },
    }
  }

  let json: OpenClawAgentJson | null = null
  try {
    json = JSON.parse(stdout.trim()) as OpenClawAgentJson
  } catch {
    return {
      ok: false,
      error: { code: 'OPENCLAW_INVALID_JSON', message: 'openclaw returned non-JSON output' },
    }
  }

  if (json.status === 'in_flight') {
    return {
      ok: false,
      error: {
        code: 'OPENCLAW_IN_FLIGHT',
        message: 'openclaw reported the run is already in flight for this session',
      },
    }
  }

  const text = (json.payloads ?? [])
    .map((payload) => payload.text ?? '')
    .filter(Boolean)
    .join('\n')

  return {
    ok: true,
    text,
    meta: {
      durationMs: json.meta?.durationMs,
      transport: json.meta?.transport,
      fallbackFrom: json.meta?.fallbackFrom,
      fallbackReason: json.meta?.fallbackReason,
    },
  }
}

export function openClawRunId(): string {
  return randomUUID()
}
