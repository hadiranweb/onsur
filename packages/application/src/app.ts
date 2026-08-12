import type { Pool } from 'pg'
import { createPgPool } from './infrastructure/pg'
import { createPostgresRepositories } from './infrastructure/postgres-repositories'
import { FakeStructuredLlm } from './infrastructure/fake-structured-llm'
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher'
import { HmacSessionCodec } from './infrastructure/session-codec'
import { AuthService } from './services/auth-service'
import { FounderService } from './services/founder-service'
import { WorkspaceService } from './services/workspace-service'
import type { StructuredLlmPort } from './ports'

export interface AppServices {
  auth: AuthService
  workspaces: WorkspaceService
  founder: FounderService
  pool: Pool
  close(): Promise<void>
}

export interface AppServicesConfig {
  databaseUrl: string
  authSecret: string
  pool?: Pool
  structuredLlm?: StructuredLlmPort
}

/**
 * Composition root: wire the PostgreSQL adapters, crypto, and application
 * services together. A single pool is shared by all repositories.
 *
 * The structured LLM defaults to a deterministic fake until a real model
 * provider is integrated (Sprint 06+). Passing `structuredLlm` overrides it.
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

  const founder = new FounderService({
    problems: repositories.problems,
    specifications: repositories.specifications,
    sps: repositories.sps,
    llm: config.structuredLlm ?? new FakeStructuredLlm(),
    workspaces,
  })

  return {
    auth,
    workspaces,
    founder,
    pool,
    async close() {
      await pool.end()
    },
  }
}
