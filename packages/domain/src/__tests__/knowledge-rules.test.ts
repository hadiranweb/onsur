import { describe, expect, it } from 'vitest'
import {
  canKnowledgeTransition,
  isNextPatch,
  nextKnowledgeState,
  validateKnowledge,
} from '../index'
import type { Knowledge } from '@element-plus/contracts'

const knowledge = (overrides: Partial<Knowledge> = {}): Knowledge => ({
  id: 'k-1',
  workspaceId: 'ws-1',
  ownerId: 'user-1',
  version: '1.0.0',
  status: 'draft',
  title: 'Known fix',
  content: 'the fix is to retry',
  evidenceRefs: [],
  provenance: {
    createdAt: '2026-08-13T00:00:00.000Z',
    derivedFrom: [],
    reason: 'test',
    source: 'system',
  },
  ...overrides,
})

describe('knowledge lifecycle', () => {
  it('advances draft -> published -> superseded', () => {
    expect(nextKnowledgeState('draft', 'publish')).toBe('published')
    expect(nextKnowledgeState('published', 'supersede')).toBe('superseded')
  })

  it('superseded is terminal', () => {
    expect(canKnowledgeTransition('superseded', 'publish')).toBe(false)
    expect(() => nextKnowledgeState('superseded', 'publish')).toThrow()
  })

  it('published knowledge cannot be republished', () => {
    expect(canKnowledgeTransition('published', 'publish')).toBe(false)
  })
})

describe('knowledge validation', () => {
  it('accepts a well-formed knowledge record', () => {
    expect(validateKnowledge(knowledge())).toEqual([])
  })

  it('rejects empty title and content', () => {
    const errors = validateKnowledge(knowledge({ title: '  ', content: '' }))
    expect(errors).toContain('knowledge title must not be empty')
    expect(errors).toContain('knowledge content must not be empty')
  })
})

describe('version patch sequencing', () => {
  it('isNextPatch accepts exactly one patch forward', () => {
    expect(isNextPatch('1.0.0', '1.0.1')).toBe(true)
    expect(isNextPatch('1.0.0', '1.1.0')).toBe(false)
    expect(isNextPatch('1.0.0', '2.0.0')).toBe(false)
    expect(isNextPatch('1.0.0', '1.0.0')).toBe(false)
  })
})
