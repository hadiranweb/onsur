#!/usr/bin/env node
/**
 * Migration CLI. Applies `migrations/*.sql` in order, each in a transaction.
 *
 *   DATABASE_URL=... node packages/application/scripts/migrate.mjs
 *
 * This is a thin CLI twin of src/infrastructure/migrate.ts (which the
 * integration tests use). Keep the two in sync.
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

async function readMigrations() {
  const entries = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort()
  return Promise.all(
    entries.map(async (name) => ({
      name,
      sql: await readFile(join(MIGRATIONS_DIR, name), 'utf8'),
    })),
  )
}

async function runMigrations(pool) {
  const client = await pool.connect()
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    )
    const appliedResult = await client.query(`SELECT version FROM schema_migrations`)
    const applied = new Set(appliedResult.rows.map((row) => row.version))

    const migrations = await readMigrations()
    const appliedNames = []
    for (const migration of migrations) {
      if (applied.has(migration.name)) continue
      await client.query('BEGIN')
      try {
        await client.query(migration.sql)
        await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [migration.name])
        await client.query('COMMIT')
        appliedNames.push(migration.name)
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`migration ${migration.name} failed: ${error.message}`)
      }
    }
    return appliedNames
  } finally {
    client.release()
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }
  const pool = new pg.Pool({ connectionString: url, max: 1 })
  try {
    const applied = await runMigrations(pool)
    if (applied.length > 0) {
      console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`)
    } else {
      console.log('No pending migrations')
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
