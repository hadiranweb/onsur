/**
 * Identity and session rules (pure).
 *
 * Session validity is a function of revocation and expiry only; no database or
 * framework is involved. Passwords follow an explicit policy evaluated here so
 * it is enforced identically everywhere.
 */

export interface SessionLike {
  revokedAt: string | null
  expiresAt: string
}

export function isSessionActive(session: SessionLike, now: Date): boolean {
  if (session.revokedAt) {
    return false
  }
  return new Date(session.expiresAt).getTime() > now.getTime()
}

export function validatePassword(password: string): string[] {
  const issues: string[] = []
  if (password.length < 8) {
    issues.push('password must be at least 8 characters')
  }
  if (password.length > 128) {
    issues.push('password must be at most 128 characters')
  }
  return issues
}
