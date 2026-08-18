import { describe, expect, it } from 'vitest'
import { envSchema, getEnv, parseEnv } from '../env'

const validEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/element_plus',
  AUTH_SECRET: 'x'.repeat(32),
}

describe('environment contract', () => {
  it('accepts a complete valid environment', () => {
    const result = parseEnv(validEnv)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('production')
      expect(result.data.DATABASE_URL).toBe(validEnv.DATABASE_URL)
      expect(result.data.AUTH_SECRET).toBe(validEnv.AUTH_SECRET)
    }
  })

  it('defaults NODE_ENV to development when absent', () => {
    const result = parseEnv({
      DATABASE_URL: validEnv.DATABASE_URL,
      AUTH_SECRET: validEnv.AUTH_SECRET,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development')
    }
  })

  it('requires DATABASE_URL', () => {
    const result = parseEnv({ AUTH_SECRET: validEnv.AUTH_SECRET })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.join(' ')).toContain('DATABASE_URL')
    }
  })

  it('requires AUTH_SECRET and rejects short secrets', () => {
    const missing = parseEnv({ DATABASE_URL: validEnv.DATABASE_URL })
    expect(missing.success).toBe(false)

    const short = parseEnv({ DATABASE_URL: validEnv.DATABASE_URL, AUTH_SECRET: 'short' })
    expect(short.success).toBe(false)
  })

  it('rejects an unknown NODE_ENV value', () => {
    const result = parseEnv({ ...validEnv, NODE_ENV: 'bogus' })
    expect(result.success).toBe(false)
  })

  it('getEnv throws a descriptive error when the environment is invalid', () => {
    expect(() => getEnv({})).toThrow(/Invalid environment/)
  })

  it('schema shape is stable', () => {
    const keys = Object.keys(envSchema.shape)
    expect(keys).toEqual(['NODE_ENV', 'DATABASE_URL', 'AUTH_SECRET'])
  })
})
