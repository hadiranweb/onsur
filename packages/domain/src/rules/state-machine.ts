/**
 * Generic, dependency-free state machine over string states and events.
 *
 * Every canonical lifecycle (run, island, process, evidence, feedback,
 * version proposal) is expressed as an explicit transition table so that
 * illegal transitions are impossible by construction.
 */

export type TransitionTable<S extends string, E extends string> = Record<S, Partial<Record<E, S>>>

export function canTransition<S extends string, E extends string>(
  table: TransitionTable<S, E>,
  from: S,
  event: E,
): boolean {
  return table[from]?.[event] !== undefined
}

export function nextState<S extends string, E extends string>(
  table: TransitionTable<S, E>,
  from: S,
  event: E,
): S {
  const next = table[from]?.[event]
  if (next === undefined) {
    throw new Error(`invalid transition: event "${event}" is not allowed from state "${from}"`)
  }
  return next
}
