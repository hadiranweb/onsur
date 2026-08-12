import type { Pool } from 'pg'
import { createPgPool } from './infrastructure/pg'
import { createPostgresRepositories } from './infrastructure/postgres-repositories'
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher'
import { HmacSessionCodec } from './infrastructure/session-codec'
import { AuthService } from './services/auth-service'
import { WorkspaceService } from './services/workspace-service'

export interface AppServices {
  auth: AuthService
  workspaces: WorkspaceService
  pool: Pool
  close(): Promise<void>
}

export interface AppServicesConfig {
  databaseUrl: string
  authSecret: string
  pool?: Pool
}

/**
 * Composition root: wire the PostgreSQL adapters, crypto, and application
 * services together. A single pool is shared by all repositories.
 */
export function createAppServices(config: AppServicesConfig): AppServices {
  const pool = config.pool ?? createPgPool(config.databaseUrl)
  const repositories = createPostgresRepositories(pool)

  const workspaces = new WorkspaceService({
    workspaces: repositories.workspaces,
    memberships: repositories.memberships,
  })

  const auth = new AuthService({
    users: repositories.users,
    sessions: repositories.sessions,
    hasher: new ScryptPasswordHasher(),
    codec: new HmacSessionCodec(config.authSecret),
    workspaces,
  })

  return {
    auth,
    workspaces,
    pool,
    async close() {
      await pool.end()
    },
  }
}
