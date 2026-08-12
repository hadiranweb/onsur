import { describe, expect, it } from 'vitest'
import { envSchema, getEnv, parseEnv } from '../env'

describe('environment contract', () => {
  it('accepts a minimal valid environment', () => {
    const result = parseEnv({ NODE_ENV: 'production', AUTH_SECRET: 'x'.repeat(32) })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('production')
      expect(result.data.AUTH_SECRET).toBe('x'.repeat(32))
    }
  })

  it('defaults NODE_ENV to development when absent', () => {
    const result = parseEnv({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development')
    }
  })

  it('treats DATABASE_URL and AUTH_SECRET as optional in Sprint 00', () => {
    const result = parseEnv({ NODE_ENV: 'test' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.DATABASE_URL).toBeUndefined()
      expect(result.data.AUTH_SECRET).toBeUndefined()
    }
  })

  it('rejects an unknown NODE_ENV value', () => {
    const result = parseEnv({ NODE_ENV: 'bogus' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  it('getEnv throws a descriptive error when the environment is invalid', () => {
    expect(() => getEnv({ NODE_ENV: 'bogus' })).toThrow(/Invalid environment/)
  })

  it('schema shape is stable', () => {
    const keys = Object.keys(envSchema.shape)
    expect(keys).toEqual(['NODE_ENV', 'DATABASE_URL', 'AUTH_SECRET'])
  })
})
