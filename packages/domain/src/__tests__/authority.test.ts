import { describe, expect, it } from 'vitest'
import { isToolExecutionAuthorized, requiresApproval } from '../index'

describe('permission gate (default deny)', () => {
  it('irreversible effects always require approval', () => {
    expect(requiresApproval('external_irreversible', false)).toBe(true)
    expect(requiresApproval('external_irreversible', true)).toBe(true)
  })

  it('reversible effects require approval only when flagged', () => {
    expect(requiresApproval('external_reversible', true)).toBe(true)
    expect(requiresApproval('external_reversible', false)).toBe(false)
  })

  it('read-only effects require approval only when the contract flags it', () => {
    expect(requiresApproval('read_only', false)).toBe(false)
    expect(requiresApproval('read_only', true)).toBe(true)
  })

  it('authorizes a non-approval-requiring effect', () => {
    expect(
      isToolExecutionAuthorized({
        effectKind: 'read_only',
        requiresApproval: false,
        approvalStatus: null,
      }),
    ).toBe(true)
  })

  it('authorizes only an approved effectful tool (default deny)', () => {
    expect(
      isToolExecutionAuthorized({
        effectKind: 'external_irreversible',
        requiresApproval: false,
        approvalStatus: 'approved',
      }),
    ).toBe(true)
    expect(
      isToolExecutionAuthorized({
        effectKind: 'external_irreversible',
        requiresApproval: false,
        approvalStatus: 'pending',
      }),
    ).toBe(false)
    expect(
      isToolExecutionAuthorized({
        effectKind: 'external_irreversible',
        requiresApproval: false,
        approvalStatus: 'rejected',
      }),
    ).toBe(false)
    expect(
      isToolExecutionAuthorized({
        effectKind: 'external_irreversible',
        requiresApproval: false,
        approvalStatus: null,
      }),
    ).toBe(false)
  })
})
