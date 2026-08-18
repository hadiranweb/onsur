import { describe, expect, it } from 'vitest'
import { correlationSurvives, deliveryKey, validatePackageCorrelation } from '../index'
import type { PackageEnvelope } from '@element-plus/contracts'

const provenance = {
  createdAt: '2026-08-13T00:00:00.000Z',
  derivedFrom: [],
  reason: 'test',
  source: 'system' as const,
}

function envelope(overrides: Partial<PackageEnvelope> = {}): PackageEnvelope {
  return {
    id: 'msg-1',
    kind: 'command',
    correlationId: 'corr-1',
    payload: {},
    provenance,
    ...overrides,
  }
}

describe('package protocol correlation invariants', () => {
  it('accepts a well-formed envelope', () => {
    expect(validatePackageCorrelation(envelope())).toEqual([])
  })

  it('rejects an envelope whose causationId equals its id', () => {
    const issues = validatePackageCorrelation(envelope({ causationId: 'msg-1' }))
    expect(issues).toContain('causationId must not equal the message id')
  })

  it('correlation survives across a cause/effect chain', () => {
    const cause = envelope({ id: 'msg-1' })
    const effect = envelope({ id: 'msg-2', causationId: 'msg-1' })
    expect(correlationSurvives(effect, cause)).toBe(true)
  })

  it('correlation does not survive when the chain is broken', () => {
    const cause = envelope({ id: 'msg-1', correlationId: 'corr-1' })
    const effect = envelope({ id: 'msg-2', correlationId: 'corr-2', causationId: 'msg-1' })
    expect(correlationSurvives(effect, cause)).toBe(false)
  })

  it('derives a stable delivery key', () => {
    expect(deliveryKey('msg-1', 'relay')).toBe('relay::msg-1')
  })
})
