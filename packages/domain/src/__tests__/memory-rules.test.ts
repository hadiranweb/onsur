import { describe, expect, it } from 'vitest'
import { canReadMemory, canWriteMemory } from '../index'

const owner = 'user-1'
const member = 'user-2'
const outsider = 'user-3'

describe('scoped memory authorization (default deny)', () => {
  describe('write', () => {
    it('private: only the owner may write', () => {
      expect(
        canWriteMemory({ scope: 'private', ownerId: owner, requesterId: owner, membership: null }),
      ).toBe(true)
      expect(
        canWriteMemory({
          scope: 'private',
          ownerId: owner,
          requesterId: member,
          membership: { role: 'member' },
        }),
      ).toBe(false)
    })

    it('workspace: members may write, non-members may not', () => {
      expect(
        canWriteMemory({
          scope: 'workspace',
          ownerId: owner,
          requesterId: member,
          membership: { role: 'member' },
        }),
      ).toBe(true)
      expect(
        canWriteMemory({
          scope: 'workspace',
          ownerId: owner,
          requesterId: outsider,
          membership: null,
        }),
      ).toBe(false)
    })

    it('shared: members may write', () => {
      expect(
        canWriteMemory({
          scope: 'shared',
          ownerId: owner,
          requesterId: member,
          membership: { role: 'member' },
        }),
      ).toBe(true)
      expect(
        canWriteMemory({
          scope: 'shared',
          ownerId: owner,
          requesterId: outsider,
          membership: null,
        }),
      ).toBe(false)
    })
  })

  describe('read', () => {
    it('private: only the owner may read', () => {
      expect(
        canReadMemory({
          scope: 'private',
          ownerId: owner,
          requesterId: owner,
          membership: null,
          isAuthenticated: true,
        }),
      ).toBe(true)
      expect(
        canReadMemory({
          scope: 'private',
          ownerId: owner,
          requesterId: member,
          membership: { role: 'member' },
          isAuthenticated: true,
        }),
      ).toBe(false)
    })

    it('workspace: cross-workspace retrieval is denied for non-members', () => {
      expect(
        canReadMemory({
          scope: 'workspace',
          ownerId: owner,
          requesterId: member,
          membership: { role: 'member' },
          isAuthenticated: true,
        }),
      ).toBe(true)
      expect(
        canReadMemory({
          scope: 'workspace',
          ownerId: owner,
          requesterId: outsider,
          membership: null,
          isAuthenticated: true,
        }),
      ).toBe(false)
    })

    it('shared: any authenticated user may read', () => {
      expect(
        canReadMemory({
          scope: 'shared',
          ownerId: owner,
          requesterId: outsider,
          membership: null,
          isAuthenticated: true,
        }),
      ).toBe(true)
      expect(
        canReadMemory({
          scope: 'shared',
          ownerId: owner,
          requesterId: outsider,
          membership: null,
          isAuthenticated: false,
        }),
      ).toBe(false)
    })
  })
})
