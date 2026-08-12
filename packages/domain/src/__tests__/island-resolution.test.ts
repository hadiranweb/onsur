import { describe, expect, it } from 'vitest'
import { islandMatchScore, islandProvidesAll, resolveIsland } from '../index'
import type { Island } from '@element-plus/contracts'

function island(id: string, capabilityIds: string[], status: Island['status'] = 'active'): Island {
  return {
    id,
    version: '1.0.0',
    status,
    name: `island ${id}`,
    description: 'test island',
    capabilities: capabilityIds.map((capabilityId) => ({ id: capabilityId, kind: 'capability' })),
    runtime: { runtime: 'fake', config: {} },
    permissions: [],
    provenance: {
      createdAt: '2026-08-13T00:00:00.000Z',
      derivedFrom: [],
      reason: 'test',
      source: 'system',
    },
  }
}

describe('island capability resolution (reuse before creation)', () => {
  it('an island providing all required capabilities is compatible', () => {
    expect(islandProvidesAll(island('a', ['cap-1', 'cap-2']), ['cap-1'])).toBe(true)
    expect(islandProvidesAll(island('a', ['cap-1']), ['cap-1', 'cap-2'])).toBe(false)
  })

  it('scores matches by number of required capabilities provided', () => {
    const subject = island('a', ['cap-1', 'cap-2', 'cap-3'])
    expect(islandMatchScore(subject, ['cap-1'])).toBe(1)
    expect(islandMatchScore(subject, ['cap-1', 'cap-2'])).toBe(2)
    expect(islandMatchScore(subject, ['cap-9'])).toBe(0)
  })

  it('resolves the best compatible island', () => {
    const candidates = [
      island('a', ['cap-1']),
      island('b', ['cap-1', 'cap-2']),
      island('c', ['cap-3']),
    ]
    const resolution = resolveIsland(candidates, ['cap-1', 'cap-2'])
    expect(resolution).not.toBeNull()
    expect(resolution!.island.id).toBe('b')
    expect(resolution!.score).toBe(2)
  })

  it('returns null when no island provides all required capabilities', () => {
    const candidates = [island('a', ['cap-1']), island('c', ['cap-3'])]
    expect(resolveIsland(candidates, ['cap-1', 'cap-2'])).toBeNull()
  })

  it('returns null for an empty requirement set', () => {
    expect(resolveIsland([island('a', ['cap-1'])], [])).toBeNull()
  })
})
