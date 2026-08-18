import type { PackageEnvelope } from '@element-plus/contracts'

/**
 * Element Package Protocol invariants (pure).
 *
 * - `correlationId` is required and links a request/response chain; it must
 *   survive asynchronous delivery unchanged.
 * - `causationId` (optional) links a message to the message that caused it.
 * - A message is its own correlation root when it has no causationId; a caused
 *   message must never reuse its own id as its correlationId.
 */

export function validatePackageCorrelation(envelope: PackageEnvelope): string[] {
  const issues: string[] = []
  if (!envelope.correlationId) {
    issues.push('correlationId is required')
  }
  if (envelope.causationId && envelope.causationId === envelope.id) {
    issues.push('causationId must not equal the message id')
  }
  return issues
}

/** A caused message correlates to the same chain as its causation root. */
export function correlationSurvives(caused: PackageEnvelope, cause: PackageEnvelope): boolean {
  return caused.correlationId === cause.correlationId
}

/**
 * Delivery idempotency: a delivery keyed by (messageId, connectorId) applied
 * twice must produce one effect. Consumers encode this by a unique delivery
 * record per (messageId, connectorId).
 */
export function deliveryKey(messageId: string, connectorId: string): string {
  return `${connectorId}::${messageId}`
}
