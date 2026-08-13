import { describe, expect, it } from 'vitest'
import { canPublishAsset, forkProvenanceDerivesFrom, installsExactVersion } from '../index'
import type { Asset } from '@element-plus/contracts'

const provenance = (derivedFrom: Asset['provenance']['derivedFrom'] = []) => ({
  createdAt: '2026-08-13T00:00:00.000Z',
  derivedFrom,
  reason: 'test',
  source: 'system' as const,
})

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    version: '1.0.0',
    kind: 'island',
    name: 'My Island Asset',
    description: 'a test asset',
    tags: [],
    owner: { id: 'user-1', kind: 'user' },
    visibility: 'private',
    license: 'MIT',
    contentRef: { id: 'isl-1', kind: 'island' },
    provenance: provenance(),
    ...overrides,
  }
}

describe('asset publication gate', () => {
  it('a non-public asset is always publishable (visibility change not required)', () => {
    expect(canPublishAsset(asset(), 'private').allowed).toBe(true)
  })

  it('a public asset requires a license', () => {
    expect(canPublishAsset(asset({ license: '  ' })).allowed).toBe(false)
    expect(canPublishAsset(asset({ license: 'MIT' })).allowed).toBe(true)
  })

  it('a dataset cannot be public without rights metadata', () => {
    const dataset = asset({ kind: 'dataset', license: 'MIT', rights: undefined })
    expect(canPublishAsset(dataset).allowed).toBe(false)
    expect(canPublishAsset(dataset).issues.join(' ')).toContain('rights metadata')

    const withRights = asset({
      kind: 'dataset',
      license: 'MIT',
      rights: { holder: 'Acme', terms: 'CC-BY' },
    })
    expect(canPublishAsset(withRights).allowed).toBe(true)
  })
})

describe('fork provenance', () => {
  it('a fork derives from the source asset with a new identity', () => {
    const source = asset({ id: 'asset-1' })
    const fork = asset({
      id: 'asset-2',
      provenance: provenance([{ id: 'asset-1', kind: 'asset' }]),
    })
    expect(forkProvenanceDerivesFrom(fork, source)).toBe(true)
  })

  it('a non-derived asset does not satisfy fork provenance', () => {
    const source = asset({ id: 'asset-1' })
    const unrelated = asset({ id: 'asset-2' })
    expect(forkProvenanceDerivesFrom(unrelated, source)).toBe(false)
  })
})

describe('exact-version installs', () => {
  it('accepts strict semver only', () => {
    expect(installsExactVersion('1.2.3')).toBe(true)
    expect(installsExactVersion('1.2')).toBe(false)
    expect(installsExactVersion('latest')).toBe(false)
  })
})
