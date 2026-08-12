/**
 * Published/versioned object immutability semantics.
 *
 * Canonical objects in a published state must never be silently mutated. We
 * express this in two complementary ways:
 * - `publishObject` deep-freezes a value into an immutable snapshot;
 * - `assertMutable` / `mutateObject` reject in-place mutation of an object
 *   whose status is published.
 */

const PUBLISHED_STATUSES = new Set<string>([
  'published',
  'active',
  'merged',
  'completed',
  'applied',
  'accepted',
  'superseded',
])

export function isPublishedStatus(status: string): boolean {
  return PUBLISHED_STATUSES.has(status)
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of Object.keys(record)) {
      deepFreeze(record[key])
    }
    Object.freeze(value)
  }
  return value
}

/** Produce an immutable, deep-frozen snapshot of a value. */
export function publishObject<T>(value: T): Readonly<T> {
  return deepFreeze(value)
}

/** Throw if the given status denotes a published (immutable) object. */
export function assertMutable(status: string): void {
  if (isPublishedStatus(status)) {
    throw new Error(`cannot mutate object in published state "${status}"`)
  }
}

/**
 * Apply a mutator to a draft object only when its status permits mutation.
 * Returns the (possibly mutated) object.
 */
export function mutateObject<T>(status: string, object: T, mutator: (draft: T) => void): T {
  assertMutable(status)
  mutator(object)
  return object
}
