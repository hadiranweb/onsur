import type { Asset } from '@element-plus/contracts'

/**
 * Asset publication gate (pure).
 *
 * - A public asset requires a license.
 * - A dataset may be published publicly only with explicit rights metadata.
 * - Published assets are immutable: a fork creates a new identity/version with
 *   `derivedFrom` provenance rather than mutating the source.
 */

export interface AssetPublicationReport {
  allowed: boolean
  issues: string[]
}

export function canPublishAsset(
  asset: Asset,
  targetVisibility: Asset['visibility'] = 'public',
): AssetPublicationReport {
  const issues: string[] = []
  if (targetVisibility !== 'public') {
    return { allowed: true, issues }
  }
  if (asset.license.trim().length === 0) {
    issues.push('public assets require a license')
  }
  if (asset.kind === 'dataset') {
    if (!asset.rights || Object.keys(asset.rights).length === 0) {
      issues.push('datasets require explicit rights metadata before public publication')
    }
  }
  return { allowed: issues.length === 0, issues }
}

/** A fork is a new identity; its provenance derives from the source asset. */
export function forkProvenanceDerivesFrom(fork: Asset, source: Asset): boolean {
  return (
    fork.id !== source.id &&
    fork.provenance.derivedFrom.some((ref) => ref.id === source.id && ref.kind === 'asset')
  )
}

/** Installs are exact-version: the install references a specific asset version. */
export function installsExactVersion(version: string): boolean {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
}
