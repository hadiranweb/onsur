import type { EffectKind } from '@element-plus/contracts'

/**
 * Permission gate / authorization (pure rules). Default authorization is deny.
 *
 * A tool execution is authorized when it needs no approval, or when an
 * approval exists and is `approved`. Anything irreversible always needs
 * approval regardless of the tool contract's `requiresApproval` flag.
 */

export function requiresApproval(effectKind: EffectKind, requiresApprovalFlag: boolean): boolean {
  if (effectKind === 'external_irreversible') {
    return true
  }
  return requiresApprovalFlag
}

export function isToolExecutionAuthorized(params: {
  effectKind: EffectKind
  requiresApproval: boolean
  approvalStatus: 'approved' | 'pending' | 'rejected' | null
}): boolean {
  if (!requiresApproval(params.effectKind, params.requiresApproval)) {
    return true
  }
  return params.approvalStatus === 'approved'
}
