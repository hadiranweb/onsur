/**
 * @element-plus/contracts
 *
 * Canonical Zod schemas for Element Plus (عنصر پلاس). Sprint 00 ships the
 * environment contract; the canonical domain language (IDs/references,
 * ProblemSpecification, Evidence, Process, Island, Run, ...) arrives in
 * Sprint 01.
 */
export { envSchema, getEnv, parseEnv } from './env'
export type { Env, EnvResult } from './env'
