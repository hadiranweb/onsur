import { describe, expect, it } from 'vitest'
import { isSessionActive, validatePassword } from '../index'

const NOW = new Date('2026-08-13T00:00:00.000Z')

describe('session rules', () => {
  it('an unexpired, unrevoked session is active', () => {
    expect(isSessionActive({ revokedAt: null, expiresAt: '2026-08-20T00:00:00.000Z' }, NOW)).toBe(
      true,
    )
  })

  it('a revoked session is inactive even before expiry', () => {
    expect(
      isSessionActive(
        { revokedAt: '2026-08-12T00:00:00.000Z', expiresAt: '2026-08-20T00:00:00.000Z' },
        NOW,
      ),
    ).toBe(false)
  })

  it('an expired session is inactive', () => {
    expect(isSessionActive({ revokedAt: null, expiresAt: '2026-08-12T00:00:00.000Z' }, NOW)).toBe(
      false,
    )
  })

  it('a session expiring exactly now is inactive', () => {
    expect(isSessionActive({ revokedAt: null, expiresAt: NOW.toISOString() }, NOW)).toBe(false)
  })
})

describe('password policy', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('short')).toEqual(['password must be at least 8 characters'])
  })

  it('rejects passwords longer than 128 characters', () => {
    expect(validatePassword('a'.repeat(129))).toEqual(['password must be at most 128 characters'])
  })

  it('accepts valid passwords', () => {
    expect(validatePassword('password123')).toEqual([])
  })
})
