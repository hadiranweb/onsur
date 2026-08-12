/**
 * Version invariants (strict semver MAJOR.MINOR.PATCH).
 *
 * Canonical, versioned objects may only move forward: a new version must be
 * strictly greater than the version it supersedes, and a version that already
 * exists must never be re-published (published versions are immutable).
 */

export type SemverTriple = [number, number, number]

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function parseVersion(version: string): SemverTriple {
  if (!SEMVER_RE.test(version)) {
    throw new Error(`invalid version "${version}": expected semver MAJOR.MINOR.PATCH`)
  }
  const [major, minor, patch] = version.split('.').map(Number) as [number, number, number]
  return [major, minor, patch]
}

export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const [aMajor, aMinor, aPatch] = parseVersion(a)
  const [bMajor, bMinor, bPatch] = parseVersion(b)
  if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1
  if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1
  return 0
}

export function isVersionGreater(newVersion: string, currentVersion: string): boolean {
  return compareVersions(newVersion, currentVersion) > 0
}

/**
 * Throw unless `newVersion` is strictly greater than `currentVersion`.
 */
export function assertNewVersion(
  newVersion: string,
  currentVersion: string,
  subject: string,
): void {
  if (!isVersionGreater(newVersion, currentVersion)) {
    throw new Error(
      `${subject}: new version ${newVersion} must be greater than current version ${currentVersion}`,
    )
  }
}

/**
 * A version is publishable only if it is strictly greater than every existing
 * version of the same object (no re-publishing, no out-of-order versions).
 */
export function canPublishVersion(
  newVersion: string,
  existingVersions: readonly string[],
): boolean {
  return existingVersions.every((existing) => compareVersions(newVersion, existing) > 0)
}

/** Return the next patch version (e.g. 1.2.3 → 1.2.4). */
export function bumpPatch(version: string): string {
  const [major, minor, patch] = parseVersion(version)
  return `${major}.${minor}.${patch + 1}`
}
