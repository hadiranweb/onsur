import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'

export interface Migration {
  name: string
  sql: string
}

const DEFAULT_MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'migrations',
)

/**
 * Read versioned migrations (numbered `NNNN_name.sql`) in ascending order.
 */
export async function readMigrations(dir: string = DEFAULT_MIGRATIONS_DIR): Promise<Migration[]> {
  const entries = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort()
  return Promise.all(
    entries.map(async (name) => ({ name, sql: await readFile(join(dir, name), 'utf8') })),
  )
}

/**
 * Apply pending migrations in order, each in its own transaction, and record
 * them in `schema_migrations`. Returns the names applied during this run.
 */
export async function runMigrations(
  pool: Pool,
  dir: string = DEFAULT_MIGRATIONS_DIR,
): Promise<string[]> {
  const client = await pool.connect()
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    )
    const appliedResult = await client.query(`SELECT version FROM schema_migrations`)
    const applied = new Set<string>(appliedResult.rows.map((row) => row.version as string))

    const migrations = await readMigrations(dir)
    const appliedNames: string[] = []
    for (const migration of migrations) {
      if (applied.has(migration.name)) {
        continue
      }
      await client.query('BEGIN')
      try {
        await client.query(migration.sql)
        await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [migration.name])
        await client.query('COMMIT')
        appliedNames.push(migration.name)
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(
          `migration ${migration.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    return appliedNames
  } finally {
    client.release()
  }
}
