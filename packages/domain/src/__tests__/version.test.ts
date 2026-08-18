import { describe, expect, it } from 'vitest'
import {
  assertNewVersion,
  canPublishVersion,
  compareVersions,
  isVersionGreater,
  parseVersion,
} from '../rules/version'

describe('version invariants', () => {
  it('parses valid semver into a numeric triple', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3])
    expect(parseVersion('0.0.0')).toEqual([0, 0, 0])
  })

  it('rejects invalid versions', () => {
    for (const invalid of ['1', '1.0', 'v1.2.3', '1.2.3.4', '1.2.x', '01.2.3']) {
      expect(() => parseVersion(invalid)).toThrow()
    }
  })

  it('compares versions correctly', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1)
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1)
  })

  it('detects strictly greater versions', () => {
    expect(isVersionGreater('1.1.0', '1.0.0')).toBe(true)
    expect(isVersionGreater('1.0.0', '1.0.0')).toBe(false)
    expect(isVersionGreater('1.0.0', '1.1.0')).toBe(false)
  })

  it('assertNewVersion throws when the new version does not increase', () => {
    expect(() => assertNewVersion('1.0.0', '1.0.0', 'knowledge')).toThrow()
    expect(() => assertNewVersion('0.9.0', '1.0.0', 'knowledge')).toThrow()
    expect(() => assertNewVersion('1.1.0', '1.0.0', 'knowledge')).not.toThrow()
  })

  it('a version is publishable only when strictly newer than all existing versions', () => {
    expect(canPublishVersion('2.0.0', ['1.0.0', '1.1.0'])).toBe(true)
    expect(canPublishVersion('1.1.1', ['1.0.0', '1.1.0'])).toBe(true)
    expect(canPublishVersion('1.1.0', ['1.0.0', '1.1.0'])).toBe(false)
    expect(canPublishVersion('1.0.0', ['1.1.0'])).toBe(false)
    expect(canPublishVersion('1.0.0', [])).toBe(true)
  })
})
