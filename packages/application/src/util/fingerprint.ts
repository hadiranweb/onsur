import { createHash } from 'node:crypto'

/**
 * Deterministic exact-content fingerprint. Exact duplicate detection compares
 * these fingerprints; approximate detection normalizes content separately
 * (see @element-plus/domain `isApproximateDuplicate`).
 */
export function fingerprintContent(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`
}
