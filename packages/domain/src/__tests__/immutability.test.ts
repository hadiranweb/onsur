import { describe, expect, it } from 'vitest'
import { assertMutable, deepFreeze, isPublishedStatus, mutateObject, publishObject } from '../index'

describe('published object immutability', () => {
  it('publishObject deep-freezes nested structures', () => {
    const draft = { title: 'x', nested: { value: 1 }, list: [{ a: 1 }] }
    const published = publishObject(draft)

    expect(Object.isFrozen(published)).toBe(true)
    expect(Object.isFrozen(published.nested)).toBe(true)
    expect(Object.isFrozen(published.list)).toBe(true)
    expect(Object.isFrozen(published.list[0])).toBe(true)
  })

  it('a frozen snapshot rejects mutation at runtime', () => {
    const published = publishObject({ title: 'x' })
    const mutable = published as unknown as { title: string }
    expect(() => {
      mutable.title = 'y'
    }).toThrow()
  })

  it('assertMutable rejects published statuses and permits draft statuses', () => {
    expect(() => assertMutable('published')).toThrow()
    expect(() => assertMutable('active')).toThrow()
    expect(() => assertMutable('merged')).toThrow()
    expect(() => assertMutable('draft')).not.toThrow()
  })

  it('mutateObject mutates a draft but refuses a published object', () => {
    const draft = { title: 'draft' }
    mutateObject('draft', draft, (d) => {
      d.title = 'changed'
    })
    expect(draft.title).toBe('changed')

    const published = { title: 'published' }
    expect(() =>
      mutateObject('published', published, (d) => {
        d.title = 'nope'
      }),
    ).toThrow()
  })

  it('deepFreeze leaves primitives untouched', () => {
    expect(deepFreeze(42)).toBe(42)
    expect(deepFreeze('abc')).toBe('abc')
  })

  it('isPublishedStatus covers the canonical published states', () => {
    for (const status of ['published', 'active', 'merged', 'completed', 'applied']) {
      expect(isPublishedStatus(status)).toBe(true)
    }
    for (const status of ['draft', 'pending', 'running']) {
      expect(isPublishedStatus(status)).toBe(false)
    }
  })
})
