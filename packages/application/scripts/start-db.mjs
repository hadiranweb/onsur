#!/usr/bin/env node
/**
 * Local PostgreSQL development server.
 *
 * Boots a real PostgreSQL engine (PGlite, compiled to WASM) and exposes it
 * over the standard Postgres wire protocol so the `pg` driver connects with a
 * normal DATABASE_URL. The same adapter code runs unchanged against any
 * hosted PostgreSQL.
 *
 *   node packages/application/scripts/start-db.mjs
 *   PG_PORT=5433 PG_DATA_DIR=.data/pg node ...   (optional overrides)
 */
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const host = process.env.PG_HOST ?? '127.0.0.1'
const port = Number(process.env.PG_PORT ?? 5432)
const dataDir = process.env.PG_DATA_DIR || undefined

const db = await PGlite.create(dataDir)
const server = new PGLiteSocketServer({ db, port, host, maxConnections: 10 })
await server.start()

const conn = server.getServerConn()
console.log(`PostgreSQL (PGlite) ready on ${conn}`)
console.log(`DATABASE_URL=postgres://postgres:postgres@${conn}/postgres`)

const shutdown = async () => {
  await server.stop()
  await db.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
