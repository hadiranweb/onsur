import type { Pool } from 'pg'
import { createPgPool } from './infrastructure/pg'
import { createPostgresRepositories } from './infrastructure/postgres-repositories'
import { FakeStructuredLlm } from './infrastructure/fake-structured-llm'
import { InMemoryToolRegistry } from './infrastructure/tool-registry'
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher'
import { HmacSessionCodec } from './infrastructure/session-codec'
import { AuthService } from './services/auth-service'
import { CapabilityService } from './services/capability-service'
import { FounderService } from './services/founder-service'
import { IslandService } from './services/island-service'
import { ProcessService } from './services/process-service'
import { RunEngine } from './services/run-engine'
import { WorkspaceService } from './services/workspace-service'
import type { OpenClawCliConfig } from './openclaw/cli'
import type { StructuredLlmPort } from './ports'

export interface AppServices {
  auth: AuthService
  workspaces: WorkspaceService
  founder: FounderService
  capabilities: CapabilityService
  processes: ProcessService
  islands: IslandService
  runs: RunEngine
  openClaw?: OpenClawCliConfig
  pool: Pool
  close(): Promise<void>
}

export interface AppServicesConfig {
  databaseUrl: string
  authSecret: string
  pool?: Pool
  structuredLlm?: StructuredLlmPort
  openClaw?: OpenClawCliConfig
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

  const capabilities = new CapabilityService({ capabilities: repositories.capabilities })

  const processes = new ProcessService({ processes: repositories.processes })

  const islands = new IslandService({ islands: repositories.islands, capabilities })

  const runs = new RunEngine({
    runs: repositories.runs,
    approvals: repositories.approvals,
    toolCalls: repositories.toolCalls,
    effects: repositories.effects,
    artifacts: repositories.artifacts,
    evaluations: repositories.evaluations,
    specifications: repositories.specifications,
    registry: new InMemoryToolRegistry(),
    islands,
    processes,
    openClawConfig: config.openClaw,
  })

  return {
    auth,
    workspaces,
    founder,
    capabilities,
    processes,
    islands,
    runs,
    openClaw: config.openClaw,
    pool,
    async close() {
      await pool.end()
    },
  }
}
