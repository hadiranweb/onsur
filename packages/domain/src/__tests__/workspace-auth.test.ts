import { describe, expect, it } from 'vitest'
import { canAccessWorkspace, isWorkspaceOwner, roleAtLeast } from '../index'

describe('workspace authorization (default deny)', () => {
  it('denies when there is no membership', () => {
    expect(canAccessWorkspace(null)).toBe(false)
    expect(canAccessWorkspace(undefined)).toBe(false)
  })

  it('allows a member the member role', () => {
    expect(canAccessWorkspace({ role: 'member' }, 'member')).toBe(true)
  })

  it('allows an owner the member role', () => {
    expect(canAccessWorkspace({ role: 'owner' }, 'member')).toBe(true)
  })

  it('denies a member the owner role', () => {
    expect(canAccessWorkspace({ role: 'member' }, 'owner')).toBe(false)
  })

  it('orders roles so owner outranks member', () => {
    expect(roleAtLeast('owner', 'owner')).toBe(true)
    expect(roleAtLeast('owner', 'member')).toBe(true)
    expect(roleAtLeast('member', 'owner')).toBe(false)
    expect(roleAtLeast('member', 'member')).toBe(true)
  })

  it('identifies owners', () => {
    expect(isWorkspaceOwner({ role: 'owner' })).toBe(true)
    expect(isWorkspaceOwner({ role: 'member' })).toBe(false)
    expect(isWorkspaceOwner(null)).toBe(false)
  })
})
