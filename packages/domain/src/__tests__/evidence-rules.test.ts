import { describe, expect, it } from 'vitest'
import {
  evaluateEvidenceQuality,
  isApproximateDuplicate,
  jaccardSimilarity,
  normalizeForComparison,
  tokenize,
} from '../index'

describe('approximate duplicate detection', () => {
  it('normalizes case, punctuation, and whitespace (and preserves Persian)', () => {
    expect(normalizeForComparison('  Hello,   WORLD!  ')).toBe('hello world')
    expect(normalizeForComparison('مشکل در پرداخت')).toBe('مشکل در پرداخت')
  })

  it('tokenizes on whitespace', () => {
    expect(tokenize('The quick brown fox')).toEqual(['the', 'quick', 'brown', 'fox'])
    expect(tokenize('')).toEqual([])
  })

  it('computes Jaccard similarity', () => {
    expect(jaccardSimilarity('a b c', 'a b c')).toBe(1)
    expect(jaccardSimilarity('a b c', 'x y z')).toBe(0)
    expect(jaccardSimilarity('a b', 'a b c d')).toBeCloseTo(0.5)
  })

  it('flags near-duplicates above the threshold', () => {
    const a = 'the checkout flow fails at the payment step when a card is declined'
    const b = 'checkout flow fails at the payment step when a card is declined'
    expect(isApproximateDuplicate(a, b)).toBe(true)
  })

  it('does not flag unrelated content', () => {
    expect(isApproximateDuplicate('checkout payment fails', 'user cannot log in')).toBe(false)
  })
})

describe('evidence quality gate', () => {
  it('passes substantive content with a fingerprint', () => {
    expect(
      evaluateEvidenceQuality({ content: 'this is a real observation', fingerprint: 'sha256:x' }),
    ).toEqual({
      passed: true,
      issues: [],
    })
  })

  it('rejects content that is too short', () => {
    const report = evaluateEvidenceQuality({ content: 'tiny', fingerprint: 'sha256:x' })
    expect(report.passed).toBe(false)
    expect(report.issues.join(' ')).toContain('at least 10')
  })

  it('rejects a missing fingerprint', () => {
    const report = evaluateEvidenceQuality({
      content: 'this is long enough content',
      fingerprint: '',
    })
    expect(report.passed).toBe(false)
    expect(report.issues.join(' ')).toContain('fingerprint')
  })
})
