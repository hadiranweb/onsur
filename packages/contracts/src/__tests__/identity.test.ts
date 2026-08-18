import { describe, expect, it } from 'vitest'
import {
  createWorkspaceInputSchema,
  emailSchema,
  loginInputSchema,
  membershipSchema,
  passwordSchema,
  publicUserSchema,
  registerInputSchema,
  sessionSchema,
  userSchema,
  workspaceSchema,
} from '../identity'

describe('identity contracts', () => {
  const now = '2026-08-13T00:00:00.000Z'

  it('normalizes emails to lowercase and validates format', () => {
    expect(emailSchema.parse('  User@Example.COM ')).toBe('user@example.com')
    expect(emailSchema.safeParse('not-an-email').success).toBe(false)
  })

  it('enforces a password length policy', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false)
    expect(passwordSchema.safeParse('a'.repeat(8)).success).toBe(true)
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false)
  })

  it('parses a registration input and rejects missing fields', () => {
    const input = { email: 'USER@EXAMPLE.COM', password: 'password123', displayName: 'Ada' }
    expect(registerInputSchema.parse(input).email).toBe('user@example.com')
    expect(
      registerInputSchema.safeParse({ email: 'user@example.com', password: 'x' }).success,
    ).toBe(false)
  })

  it('parses a login input', () => {
    expect(
      loginInputSchema.parse({ email: 'user@example.com', password: 'password123' }).email,
    ).toBe('user@example.com')
  })

  it('parses a full user and exposes a public shape without the password hash', () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'secret-hash',
      displayName: 'Ada',
      createdAt: now,
      updatedAt: now,
    }
    const parsed = userSchema.parse(user)
    expect(parsed.passwordHash).toBe('secret-hash')

    const publicUser = publicUserSchema.parse(parsed)
    expect(publicUser).not.toHaveProperty('passwordHash')
    expect(publicUser.id).toBe('user-1')
  })

  it('parses a session with a nullable revokedAt', () => {
    const active = sessionSchema.parse({
      id: 's-1',
      userId: 'user-1',
      tokenHash: 'hash',
      createdAt: now,
      expiresAt: now,
      revokedAt: null,
    })
    expect(active.revokedAt).toBeNull()

    const revoked = sessionSchema.parse({ ...active, revokedAt: now })
    expect(revoked.revokedAt).toBe(now)
  })

  it('parses workspaces and memberships', () => {
    const workspace = workspaceSchema.parse({
      id: 'ws-1',
      slug: 'personal-user-1',
      name: 'Personal workspace',
      kind: 'personal',
      ownerUserId: 'user-1',
      createdAt: now,
      updatedAt: now,
    })
    expect(workspace.kind).toBe('personal')

    const membership = membershipSchema.parse({
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: now,
    })
    expect(membership.role).toBe('owner')
  })

  it('validates workspace creation input slugs', () => {
    expect(createWorkspaceInputSchema.parse({ name: 'Team', slug: 'team-1' }).slug).toBe('team-1')
    expect(createWorkspaceInputSchema.safeParse({ name: 'Team', slug: 'Team 1' }).success).toBe(
      false,
    )
    expect(createWorkspaceInputSchema.safeParse({ name: '', slug: 'team-1' }).success).toBe(false)
  })
})
