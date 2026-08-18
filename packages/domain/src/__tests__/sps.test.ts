import { describe, expect, it } from 'vitest'
import { canSpsTransition, nextSpsState } from '../index'

describe('SPS lifecycle', () => {
  it('advances open -> structuring -> review -> confirmed', () => {
    expect(nextSpsState('open', 'submit')).toBe('structuring')
    expect(nextSpsState('structuring', 'produced')).toBe('review')
    expect(nextSpsState('review', 'confirm')).toBe('confirmed')
  })

  it('supports the correction loop (review -> structuring -> review)', () => {
    expect(nextSpsState('review', 'correct')).toBe('structuring')
    expect(nextSpsState('structuring', 'produced')).toBe('review')
  })

  it('supports structuring failure back to open', () => {
    expect(nextSpsState('structuring', 'fail')).toBe('open')
  })

  it('confirmed is terminal', () => {
    for (const event of ['submit', 'produced', 'correct', 'confirm', 'fail'] as const) {
      expect(canSpsTransition('confirmed', event)).toBe(false)
      expect(() => nextSpsState('confirmed', event)).toThrow()
    }
  })

  it('rejects illegal transitions', () => {
    expect(canSpsTransition('open', 'confirm')).toBe(false)
    expect(() => nextSpsState('open', 'confirm')).toThrow()
    expect(canSpsTransition('review', 'submit')).toBe(false)
    expect(() => nextSpsState('review', 'submit')).toThrow()
  })
})
