import { Pool } from 'pg'

/**
 * Create a PostgreSQL connection pool from a connection string.
 * The adapter is written against the standard `pg` driver so it runs against
 * any PostgreSQL server (hosted or local; local dev uses PGlite over the wire
 * protocol — see scripts/start-db.mjs).
 */
export function createPgPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10 })
}
