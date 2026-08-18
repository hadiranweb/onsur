import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { Island } from '@element-plus/contracts'
import type { RuntimeEvent, RuntimeSession } from '../../ports'
import type { ProblemSpecificationRecord } from '../../ports'
import {
  assertDistinctSessionKey,
  deriveOpenClawSessionKey,
  isElementPlusSessionKey,
} from '../session-mapping'
import { classifyMemoryCandidates, renderContext, OpenClawRuntimeAdapter } from '../adapter'
import { runOpenClawAgent } from '../cli'
import { checkOpenClawHealth } from '../health'

/**
 * Contract tests for the OpenClaw adapter.
 *
 * These run against a FAKE `openclaw` binary that emits the documented JSON
 * response shape. They prove the mapping logic (context, session key, event
 * normalization, result, errors, cancellation). LIVE integration against real
 * OpenClaw is NOT RUN here: no binary or credentials are available in this
 * environment (see Sprint 06 report).
 */

const dir = mkdtempSync(join(tmpdir(), 'element-plus-fake-openclaw-'))

function writeFakeBin(script: string): string {
  const path = join(dir, 'openclaw')
  writeFileSync(path, script, { mode: 0o755 })
  return path
}

function makeSession(runId: string): RuntimeSession {
  const spec: ProblemSpecificationRecord = {
    id: 'ps-1',
    problemId: 'p-1',
    workspaceId: 'ws-1',
    version: '1.0.0',
    status: 'confirmed',
    rawProblem: 'checkout fails',
    structuredUnderstanding: 'the checkout flow fails at the payment step',
    items: [
      { kind: 'evidence', text: 'logs show a decline' },
      { kind: 'assumption', text: 'gateway is reachable' },
      { kind: 'unknown', text: 'root cause' },
    ],
    successCriteria: ['payment succeeds'],
    constraints: ['no irreversible effects'],
    provenance: {
      createdAt: '2026-08-13T00:00:00.000Z',
      derivedFrom: [],
      reason: 'test',
      source: 'system',
    },
    createdAt: '2026-08-13T00:00:00.000Z',
  }
  const island: Island = {
    id: 'isl-1',
    version: '1.0.0',
    status: 'active',
    name: 'Structured Analysis Island',
    description: 'analysis',
    capabilities: [{ id: 'cap-1', kind: 'capability' }],
    runtime: { runtime: 'openclaw', config: {} },
    permissions: [],
    provenance: {
      createdAt: '2026-08-13T00:00:00.000Z',
      derivedFrom: [],
      reason: 'test',
      source: 'system',
    },
  }
  return { runId, island, process: null, problemSpec: spec }
}

const config = (bin: string) => ({ bin, agentId: 'main', timeoutSeconds: 30, local: true })

afterAll(() => {
  // Temp dir is cleaned by the OS; nothing repo-relative to remove.
})

describe('session mapping', () => {
  it('derives an agent-prefixed session key distinct from the run id', () => {
    const key = deriveOpenClawSessionKey({ agentId: 'main', runId: 'run-123' })
    expect(key).toBe('agent:main:element-plus-run-123')
    expect(key).not.toBe('run-123')
    expect(assertDistinctSessionKey('run-123', key)).toBeNull()
  })

  it('detects element-plus session keys', () => {
    expect(isElementPlusSessionKey('agent:main:element-plus-run-1')).toBe(true)
    expect(isElementPlusSessionKey('agent:main:other')).toBe(false)
  })

  it('rejects a session key equal to the run id', () => {
    expect(assertDistinctSessionKey('same', 'same')).not.toBeNull()
  })
})

describe('context mapping', () => {
  it('renders the ProblemSpecification into the OpenClaw message', () => {
    const text = renderContext(makeSession('run-1'))
    expect(text).toContain('the checkout flow fails at the payment step')
    expect(text).toContain('checkout fails') // raw problem verbatim
    expect(text).toContain('[evidence]')
    expect(text).toContain('Success criteria')
    expect(text).toContain('payment succeeds')
  })
})

describe('memory candidate classification', () => {
  it('extracts a "Memory" section as candidates only', () => {
    const reply =
      'Analysis complete.\n\n## Memory\n- Cache the retry path\n- Note the decline code\n'
    expect(classifyMemoryCandidates(reply)).toEqual([
      'Cache the retry path',
      'Note the decline code',
    ])
  })

  it('returns no candidates when no memory section exists', () => {
    expect(classifyMemoryCandidates('just an answer')).toEqual([])
  })
})

describe('CLI result normalization (fake binary contract tests)', () => {
  it('maps a successful documented JSON response to a result', async () => {
    const bin = writeFakeBin(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const msgIdx = args.indexOf('--message-file');
const keyIdx = args.indexOf('--session-key');
const file = args[msgIdx + 1];
const key = args[keyIdx + 1];
const content = fs.readFileSync(file, 'utf8');
process.stdout.write(JSON.stringify({
  payloads: [{ text: 'Structured analysis: ' + key + ' saw ' + content.length + ' chars' }],
  meta: { durationMs: 12, transport: 'embedded' }
}));
`)
    const result = await runOpenClawAgent(config(bin), {
      sessionKey: 'agent:main:element-plus-run-1',
      message: 'hello',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('agent:main:element-plus-run-1')
      expect(result.meta.transport).toBe('embedded')
    }
  })

  it('maps a non-zero exit to a normalized error', async () => {
    const bin = writeFakeBin(`#!/usr/bin/env node
process.stderr.write('openclaw: gateway unreachable\\n');
process.exit(1);
`)
    const result = await runOpenClawAgent(config(bin), {
      sessionKey: 'agent:main:element-plus-run-2',
      message: 'hello',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('OPENCLAW_ERROR')
      expect(result.error.message).toContain('gateway unreachable')
    }
  })

  it('maps in_flight status to an error', async () => {
    const bin = writeFakeBin(`#!/usr/bin/env node
process.stdout.write(JSON.stringify({ status: 'in_flight' }));
`)
    const result = await runOpenClawAgent(config(bin), {
      sessionKey: 'agent:main:element-plus-run-3',
      message: 'hello',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('OPENCLAW_IN_FLIGHT')
    }
  })

  it('reports not_configured for a missing binary', async () => {
    const result = await runOpenClawAgent(config(join(dir, 'does-not-exist')), {
      sessionKey: 'agent:main:element-plus-run-4',
      message: 'hello',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('OPENCLAW_NOT_CONFIGURED')
    }
  })
})

describe('OpenClawRuntimeAdapter event normalization', () => {
  it('yields started then completed with a candidate-only memory mapping', async () => {
    const bin = writeFakeBin(`#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  payloads: [{ text: 'Answer\\n\\n## Memory\\n- remember the retry path' }],
  meta: { durationMs: 5 }
}));
`)
    const adapter = new OpenClawRuntimeAdapter({ cli: config(bin) })
    const events: RuntimeEvent[] = []
    for await (const event of adapter.start(makeSession('run-9'))) {
      events.push(event)
    }

    expect(events[0]?.type).toBe('started')
    const completed = events.find((event) => event.type === 'completed')
    expect(completed).toBeDefined()
    if (completed && completed.type === 'completed') {
      const result = completed.result as { memoryCandidates: string[]; openClawSessionKey: string }
      expect(result.memoryCandidates).toEqual(['remember the retry path'])
      expect(result.openClawSessionKey).toBe('agent:main:element-plus-run-9')
    }
  })

  it('yields failed when the CLI errors', async () => {
    const bin = writeFakeBin(`#!/usr/bin/env node
process.exit(2);
`)
    const adapter = new OpenClawRuntimeAdapter({ cli: config(bin) })
    const events: RuntimeEvent[] = []
    for await (const event of adapter.start(makeSession('run-10'))) {
      events.push(event)
    }
    const failed = events.find((event) => event.type === 'failed')
    expect(failed).toBeDefined()
    if (failed && failed.type === 'failed') {
      expect(failed.error.code).toBe('OPENCLAW_ERROR')
    }
  })
})

describe('health check', () => {
  it('reports not_configured when the binary is missing', async () => {
    const result = await checkOpenClawHealth(config(join(dir, 'missing')))
    expect(result.status).toBe('not_configured')
  })

  it('reports connected when the fake binary exits 0', async () => {
    const bin = writeFakeBin(`#!/usr/bin/env node
process.stdout.write('{}');
`)
    const result = await checkOpenClawHealth(config(bin))
    expect(result.status).toBe('connected')
  })

  it('reports error when the fake binary exits non-zero', async () => {
    const bin = writeFakeBin(`#!/usr/bin/env node
process.stderr.write('gateway down');
process.exit(1);
`)
    const result = await checkOpenClawHealth(config(bin))
    expect(result.status).toBe('error')
  })
})
