import { describe, expect, it } from 'vitest'
import {
  agentSchema,
  artifactSchema,
  assetSchema,
  auditEventSchema,
  capabilitySchema,
  entityKindSchema,
  evaluationSchema,
  evidenceSchema,
  feedbackSchema,
  idSchema,
  islandSchema,
  knowledgeSchema,
  memoryEntrySchema,
  packageEnvelopeSchema,
  problemSpecificationSchema,
  processSchema,
  provenanceSchema,
  referenceSchema,
  runSchema,
  timestampSchema,
  toolCallSchema,
  toolContractSchema,
  versionProposalSchema,
  versionSchema,
} from '../index'

const NOW = '2026-08-13T00:00:00.000Z'

function prov(overrides: Record<string, unknown> = {}) {
  return {
    actor: { id: 'user-1', kind: 'user' },
    createdAt: NOW,
    derivedFrom: [],
    reason: 'test fixture',
    source: 'system',
    ...overrides,
  }
}

function ref(id: string, kind: string) {
  return { id, kind }
}

describe('canonical contracts', () => {
  describe('ids and references', () => {
    it('rejects empty ids', () => {
      expect(idSchema.safeParse('').success).toBe(false)
    })

    it('rejects ids containing whitespace', () => {
      expect(idSchema.safeParse('has space').success).toBe(false)
    })

    it('rejects ids longer than 128 characters', () => {
      expect(idSchema.safeParse('x'.repeat(129)).success).toBe(false)
    })

    it('accepts a valid id and reference', () => {
      expect(idSchema.parse('run-123').length).toBeGreaterThan(0)
      expect(referenceSchema.parse(ref('run-123', 'run'))).toEqual({
        id: 'run-123',
        kind: 'run',
      })
    })

    it('rejects unknown entity kinds', () => {
      expect(referenceSchema.safeParse(ref('run-123', 'not_a_kind')).success).toBe(false)
      expect(entityKindSchema.safeParse('run').success).toBe(true)
    })
  })

  describe('version and timestamp', () => {
    it('accepts strict semver and rejects partial versions', () => {
      for (const valid of ['0.0.0', '1.2.3', '10.20.30']) {
        expect(versionSchema.safeParse(valid).success).toBe(true)
      }
      for (const invalid of ['1', '1.0', 'v1.2.3', '1.2.3.4', '1.2.x', '01.2.3']) {
        expect(versionSchema.safeParse(invalid).success).toBe(false)
      }
    })

    it('accepts ISO 8601 timestamps and rejects non-dates', () => {
      expect(timestampSchema.safeParse(NOW).success).toBe(true)
      expect(timestampSchema.safeParse('not-a-date').success).toBe(false)
    })
  })

  describe('provenance', () => {
    it('parses a valid provenance', () => {
      const parsed = provenanceSchema.parse(prov())
      expect(parsed.source).toBe('system')
    })

    it('requires a reason', () => {
      expect(provenanceSchema.safeParse(prov({ reason: '' })).success).toBe(false)
    })

    it('rejects an unknown source', () => {
      expect(provenanceSchema.safeParse(prov({ source: 'alien' })).success).toBe(false)
    })
  })

  describe('problem specification', () => {
    const valid = {
      id: 'ps-1',
      version: '1.0.0',
      status: 'confirmed',
      rawProblem: 'users cannot reset their password',
      structuredUnderstanding: 'The password reset flow is broken.',
      items: [
        { kind: 'evidence', text: 'error observed in logs' },
        { kind: 'assumption', text: 'smtp is reachable' },
        { kind: 'unknown', text: 'exact root cause' },
      ],
      successCriteria: ['user can reset password within 2 minutes'],
      constraints: [],
      provenance: prov(),
    }

    it('parses a valid specification and round-trips through JSON', () => {
      const parsed = problemSpecificationSchema.parse(valid)
      const roundTripped = problemSpecificationSchema.parse(JSON.parse(JSON.stringify(parsed)))
      expect(roundTripped.rawProblem).toBe(valid.rawProblem)
      expect(roundTripped.items).toHaveLength(3)
    })

    it('requires at least one success criterion', () => {
      expect(problemSpecificationSchema.safeParse({ ...valid, successCriteria: [] }).success).toBe(
        false,
      )
    })

    it('preserves the raw problem verbatim', () => {
      const parsed = problemSpecificationSchema.parse(valid)
      expect(parsed.rawProblem).toBe('users cannot reset their password')
    })

    it('rejects an invalid status or version', () => {
      expect(problemSpecificationSchema.safeParse({ ...valid, status: 'mystery' }).success).toBe(
        false,
      )
      expect(problemSpecificationSchema.safeParse({ ...valid, version: '1' }).success).toBe(false)
    })
  })

  describe('evidence', () => {
    const valid = {
      id: 'ev-1',
      workspaceId: 'ws-1',
      kind: 'evidence',
      content: 'log line showing 500 on /reset',
      fingerprint: 'sha256:abcdef',
      status: 'intake',
      provenance: prov(),
    }

    it('parses valid evidence and requires a fingerprint', () => {
      expect(evidenceSchema.parse(valid).fingerprint).toBe('sha256:abcdef')
      expect(evidenceSchema.safeParse({ ...valid, fingerprint: '' }).success).toBe(false)
    })

    it('rejects an invalid status', () => {
      expect(evidenceSchema.safeParse({ ...valid, status: 'promoted' }).success).toBe(false)
    })
  })

  describe('capability, process, island', () => {
    it('parses a capability', () => {
      const parsed = capabilitySchema.parse({
        id: 'cap-1',
        version: '1.0.0',
        name: 'web-search',
        description: 'search the web',
        provenance: prov(),
      })
      expect(parsed.tags).toEqual([])
    })

    it('parses a process with steps', () => {
      const parsed = processSchema.parse({
        id: 'proc-1',
        version: '1.0.0',
        status: 'draft',
        title: 'analyze',
        description: 'structured analysis',
        steps: [
          { id: 's1', order: 0, title: 'gather', instruction: 'collect inputs', status: 'pending' },
          {
            id: 's2',
            order: 1,
            title: 'analyze',
            instruction: 'analyze inputs',
            dependsOn: ['s1'],
            status: 'pending',
          },
        ],
        provenance: prov(),
      })
      expect(parsed.steps).toHaveLength(2)
    })

    it('requires at least one capability on an island', () => {
      const island = {
        id: 'isl-1',
        version: '1.0.0',
        status: 'draft',
        name: 'structured analysis',
        description: 'structured analysis island',
        capabilities: [ref('cap-1', 'capability')],
        runtime: { runtime: 'fake' },
        provenance: prov(),
      }
      expect(islandSchema.parse(island).runtime.runtime).toBe('fake')
      expect(islandSchema.safeParse({ ...island, capabilities: [] }).success).toBe(false)
    })
  })

  describe('agent and tool', () => {
    it('parses an agent', () => {
      const parsed = agentSchema.parse({
        id: 'agent-1',
        name: 'planner',
        role: 'planner',
        model: 'test-model',
        provenance: prov(),
      })
      expect(parsed.capabilities).toEqual([])
    })

    it('parses a tool contract and call with effect kinds', () => {
      const contract = toolContractSchema.parse({
        id: 'tool-1',
        name: 'send_email',
        description: 'send an email',
        inputSchema: { to: 'string' },
        effectKind: 'external_irreversible',
        requiresApproval: true,
        provenance: prov(),
      })
      expect(contract.requiresApproval).toBe(true)

      const call = toolCallSchema.parse({
        id: 'call-1',
        toolId: ref('tool-1', 'tool'),
        arguments: { to: 'a@b.c' },
        effectKind: 'external_irreversible',
        requiresApproval: true,
      })
      expect(call.effectKind).toBe('external_irreversible')

      expect(toolCallSchema.safeParse({ ...call, effectKind: 'external_super' }).success).toBe(
        false,
      )
    })
  })

  describe('package envelope', () => {
    it('requires a correlation id and a valid kind', () => {
      const valid = {
        id: 'pkg-1',
        kind: 'command',
        correlationId: 'corr-1',
        payload: { op: 'go' },
        provenance: prov(),
      }
      expect(packageEnvelopeSchema.parse(valid).kind).toBe('command')
      expect(packageEnvelopeSchema.safeParse({ ...valid, kind: 'telegram' }).success).toBe(false)
      const { correlationId: _correlationId, ...noCorr } = valid
      expect(packageEnvelopeSchema.safeParse(noCorr).success).toBe(false)
    })
  })

  describe('run and artifact', () => {
    const valid = {
      id: 'run-1',
      status: 'draft',
      snapshot: {
        problemSpec: ref('ps-1', 'problem_specification'),
        island: ref('isl-1', 'island'),
        createdAt: NOW,
      },
      events: [{ id: 'ev-1', seq: 0, type: 'enqueue', at: NOW, payload: {} }],
      provenance: prov(),
    }

    it('parses a run and rejects invalid status/event types', () => {
      expect(runSchema.parse(valid).status).toBe('draft')
      expect(runSchema.safeParse({ ...valid, status: 'exploded' }).success).toBe(false)
      expect(
        runSchema.safeParse({
          ...valid,
          events: [{ id: 'ev-1', seq: 0, type: 'teleport', at: NOW, payload: {} }],
        }).success,
      ).toBe(false)
    })

    it('parses an artifact', () => {
      const parsed = artifactSchema.parse({
        id: 'art-1',
        runId: ref('run-1', 'run'),
        kind: 'result',
        mimeType: 'application/json',
        data: { ok: true },
        provenance: prov(),
      })
      expect(parsed.kind).toBe('result')
    })
  })

  describe('evaluation and feedback', () => {
    it('parses an evaluation and bounds the score to [0,1]', () => {
      const evaluation = {
        id: 'eval-1',
        runId: ref('run-1', 'run'),
        verdict: 'pass',
        score: 0.9,
        provenance: prov(),
      }
      expect(evaluationSchema.parse(evaluation).verdict).toBe('pass')
      expect(evaluationSchema.safeParse({ ...evaluation, score: 2 }).success).toBe(false)
    })

    it('parses feedback tied to a run', () => {
      const parsed = feedbackSchema.parse({
        id: 'fb-1',
        runId: ref('run-1', 'run'),
        content: 'the analysis missed the retry path',
        status: 'submitted',
        provenance: prov(),
      })
      expect(parsed.runId.id).toBe('run-1')
    })
  })

  describe('memory', () => {
    it('enforces a known scope', () => {
      const valid = {
        id: 'mem-1',
        workspaceId: 'ws-1',
        ownerId: 'user-1',
        scope: 'workspace',
        content: 'remember this',
        status: 'candidate',
        provenance: prov(),
      }
      expect(memoryEntrySchema.parse(valid).scope).toBe('workspace')
      expect(memoryEntrySchema.safeParse({ ...valid, scope: 'galactic' }).success).toBe(false)
    })
  })

  describe('knowledge and version proposal', () => {
    it('parses knowledge with evidence references', () => {
      const parsed = knowledgeSchema.parse({
        id: 'k-1',
        workspaceId: 'ws-1',
        ownerId: 'user-1',
        version: '1.0.0',
        status: 'published',
        title: 'known fix',
        content: 'the fix is to retry',
        evidenceRefs: [ref('ev-1', 'evidence')],
        provenance: prov(),
      })
      expect(parsed.evidenceRefs).toHaveLength(1)
    })

    it('parses a version proposal and requires semver endpoints', () => {
      const parsed = versionProposalSchema.parse({
        id: 'vp-1',
        target: ref('k-1', 'knowledge'),
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        rationale: 'new evidence',
        status: 'draft',
        provenance: prov(),
      })
      expect(parsed.toVersion).toBe('1.1.0')
      expect(versionProposalSchema.safeParse({ ...parsed, toVersion: '2.0' }).success).toBe(false)
    })
  })

  describe('asset and audit event', () => {
    it('parses an asset with visibility and license', () => {
      const parsed = assetSchema.parse({
        id: 'asset-1',
        kind: 'island',
        version: '1.0.0',
        owner: ref('user-1', 'user'),
        visibility: 'public',
        license: 'MIT',
        contentRef: ref('isl-1', 'island'),
        provenance: prov(),
      })
      expect(parsed.license).toBe('MIT')
      expect(assetSchema.safeParse({ ...parsed, visibility: 'everyone' }).success).toBe(false)
    })

    it('parses an audit event with an allow/deny outcome', () => {
      const parsed = auditEventSchema.parse({
        id: 'audit-1',
        actor: ref('user-1', 'user'),
        action: 'tool.execute',
        target: ref('tool-1', 'tool'),
        at: NOW,
        outcome: 'deny',
        provenance: prov(),
      })
      expect(parsed.outcome).toBe('deny')
    })
  })
})
