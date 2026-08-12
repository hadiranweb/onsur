/**
 * Session mapping: OpenClaw session_id != Element Plus run_id.
 *
 * We derive a distinct OpenClaw session key for every Element Plus run using
 * the documented `agent:<agent-id>:<key>` shape. The mapping is deterministic
 * and reversible so a run can always be correlated back to its OpenClaw
 * session without reusing Element Plus identifiers as OpenClaw identifiers.
 */

export function deriveOpenClawSessionKey(input: { agentId: string; runId: string }): string {
  return `agent:${input.agentId}:element-plus-${input.runId}`
}

/** True when a session key was derived from an Element Plus run (vs native). */
export function isElementPlusSessionKey(sessionKey: string): boolean {
  return /^agent:[^:]+:element-plus-/.test(sessionKey)
}

/**
 * Sanity-check the invariant: the OpenClaw session key must never equal the
 * Element Plus run id. Returns a violation message, or null when OK.
 */
export function assertDistinctSessionKey(runId: string, sessionKey: string): string | null {
  if (runId === sessionKey) {
    return 'OpenClaw session key must not equal the Element Plus run id'
  }
  return null
}
