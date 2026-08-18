import type { Island, IslandEvent, IslandStatus } from '@element-plus/contracts'
import { canTransition, nextState } from './state-machine'

/**
 * Island lifecycle.
 *
 * A draft Island is proposed to candidate status, and may only become active
 * when it satisfies the activation preconditions (see `canActivateIsland`).
 * Active Islands retire rather than being silently mutated.
 */

export const islandTransitions: Record<IslandStatus, Partial<Record<IslandEvent, IslandStatus>>> = {
  draft: { propose: 'candidate', activate: 'active', retire: 'retired' },
  candidate: { activate: 'active', reject: 'draft', retire: 'retired' },
  active: { retire: 'retired' },
  retired: {},
}

export function canIslandTransition(from: IslandStatus, event: IslandEvent): boolean {
  return canTransition(islandTransitions, from, event)
}

export function nextIslandState(from: IslandStatus, event: IslandEvent): IslandStatus {
  return nextState(islandTransitions, from, event)
}

/**
 * An Island may activate only when it is well-formed and bound to a concrete
 * runtime. This is the pure precondition; authorization and registry lookup
 * are application concerns.
 */
export function canActivateIsland(island: Island): boolean {
  return (
    island.name.trim().length > 0 &&
    island.description.trim().length > 0 &&
    island.capabilities.length > 0 &&
    island.runtime.runtime !== 'none'
  )
}

/**
 * Island resolution ("reuse before creation"): an Island is compatible with a
 * request when it provides every required capability. The best match is the
 * compatible Island providing the most required capabilities.
 */

export function islandProvidesAll(
  island: Island,
  requiredCapabilityIds: readonly string[],
): boolean {
  const ids = new Set(island.capabilities.map((capability) => capability.id))
  return requiredCapabilityIds.every((id) => ids.has(id))
}

export function islandMatchScore(island: Island, requiredCapabilityIds: readonly string[]): number {
  const ids = new Set(island.capabilities.map((capability) => capability.id))
  return requiredCapabilityIds.filter((id) => ids.has(id)).length
}

export interface IslandResolution {
  island: Island
  score: number
}

/** Pick the best compatible Island from candidates, or null when none match. */
export function resolveIsland(
  candidates: readonly Island[],
  requiredCapabilityIds: readonly string[],
): IslandResolution | null {
  if (requiredCapabilityIds.length === 0) {
    return null
  }
  let best: IslandResolution | null = null
  for (const island of candidates) {
    if (!islandProvidesAll(island, requiredCapabilityIds)) {
      continue
    }
    const score = islandMatchScore(island, requiredCapabilityIds)
    if (!best || score > best.score) {
      best = { island, score }
    }
  }
  return best
}
