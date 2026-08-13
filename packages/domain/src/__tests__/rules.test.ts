import { describe, expect, it } from 'vitest'
import {
  canActivateIsland,
  canMergeProposal,
  findExactDuplicates,
  isExactDuplicate,
  isForwardProposal,
  validateProcess,
} from '../index'
import type { Evidence, Island, Process, VersionProposal } from '@element-plus/contracts'

const NOW = '2026-08-13T00:00:00.000Z'

function provenance() {
  return { createdAt: NOW, derivedFrom: [], reason: 'test', source: 'system' as const }
}

function islandFixture(overrides: Partial<Island> = {}): Island {
  return {
    id: 'isl-1',
    version: '1.0.0',
    status: 'draft',
    name: 'structured analysis',
    description: 'structured analysis island',
    capabilities: [{ id: 'cap-1', kind: 'capability' }],
    runtime: { runtime: 'fake', config: {} },
    permissions: [],
    provenance: provenance(),
    ...overrides,
  }
}

function processFixture(overrides: Partial<Process> = {}): Process {
  return {
    id: 'proc-1',
    version: '1.0.0',
    status: 'draft',
    title: 'analyze',
    description: 'analyze',
    steps: [
      {
        id: 's1',
        order: 0,
        title: 'gather',
        instruction: 'collect',
        dependsOn: [],
        status: 'pending',
      },
      {
        id: 's2',
        order: 1,
        title: 'analyze',
        instruction: 'analyze',
        dependsOn: ['s1'],
        status: 'pending',
      },
    ],
    provenance: provenance(),
    ...overrides,
  }
}

describe('island activation precondition', () => {
  it('a well-formed, runtime-bound island may activate', () => {
    expect(canActivateIsland(islandFixture())).toBe(true)
  })

  it('an island without a concrete runtime cannot activate', () => {
    expect(canActivateIsland(islandFixture({ runtime: { runtime: 'none', config: {} } }))).toBe(
      false,
    )
  })

  it('an island without capabilities cannot activate', () => {
    expect(canActivateIsland(islandFixture({ capabilities: [] }))).toBe(false)
  })

  it('an island without a name cannot activate', () => {
    expect(canActivateIsland(islandFixture({ name: '   ' }))).toBe(false)
  })
})

describe('process validation', () => {
  it('accepts a well-formed process', () => {
    expect(validateProcess(processFixture())).toEqual([])
  })

  it('rejects duplicate step ids', () => {
    const invalid = processFixture({
      steps: [
        { id: 's1', order: 0, title: 'a', instruction: 'a', dependsOn: [], status: 'pending' },
        { id: 's1', order: 1, title: 'b', instruction: 'b', dependsOn: [], status: 'pending' },
      ],
    })
    expect(validateProcess(invalid)).toContain('duplicate step id "s1"')
  })

  it('rejects duplicate step orders', () => {
    const invalid = processFixture({
      steps: [
        { id: 's1', order: 0, title: 'a', instruction: 'a', dependsOn: [], status: 'pending' },
        { id: 's2', order: 0, title: 'b', instruction: 'b', dependsOn: [], status: 'pending' },
      ],
    })
    expect(validateProcess(invalid)).toContain('duplicate step order 0')
  })

  it('rejects dependencies on unknown steps', () => {
    const invalid = processFixture({
      steps: [
        {
          id: 's1',
          order: 0,
          title: 'a',
          instruction: 'a',
          dependsOn: ['missing'],
          status: 'pending',
        },
      ],
    })
    expect(validateProcess(invalid)).toContain('step "s1" depends on unknown step "missing"')
  })
})

describe('evidence duplicate detection', () => {
  const evidence = (id: string, fingerprint: string): Evidence => ({
    id,
    workspaceId: 'ws-1',
    kind: 'evidence',
    content: 'content',
    fingerprint,
    status: 'intake',
    provenance: provenance(),
  })

  it('detects exact fingerprint duplicates', () => {
    expect(isExactDuplicate(evidence('a', 'f1'), evidence('b', 'f1'))).toBe(true)
    expect(isExactDuplicate(evidence('a', 'f1'), evidence('b', 'f2'))).toBe(false)
  })

  it('finds duplicates excluding the item itself', () => {
    const candidate = evidence('candidate', 'f1')
    const existing = [evidence('a', 'f1'), evidence('b', 'f2')]
    expect(findExactDuplicates(candidate, existing)).toHaveLength(1)
  })
})

describe('version proposal rules', () => {
  const proposal = (status: VersionProposal['status']): VersionProposal => ({
    id: 'vp-1',
    target: { id: 'k-1', kind: 'knowledge' },
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    rationale: 'new evidence',
    evidenceRefs: [],
    status,
    provenance: provenance(),
  })

  it('detects forward proposals', () => {
    expect(isForwardProposal(proposal('draft'))).toBe(true)
    expect(isForwardProposal({ ...proposal('draft'), toVersion: '1.0.0' })).toBe(false)
  })

  it('merges only approved, forward proposals', () => {
    expect(canMergeProposal(proposal('approved'))).toBe(true)
    expect(canMergeProposal(proposal('proposed'))).toBe(false)
    expect(canMergeProposal({ ...proposal('approved'), toVersion: '0.9.0' })).toBe(false)
  })
})
