import { z } from 'zod'

/**
 * The environment contract for Element Plus runtimes.
 *
 * `DATABASE_URL` and `AUTH_SECRET` are required from Sprint 02 onward
 * (identity + workspace persistence). `AUTH_SECRET` signs the session cookie
 * envelope; `DATABASE_URL` locates PostgreSQL.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is required' })
    .min(1, 'DATABASE_URL is required'),
  AUTH_SECRET: z
    .string({ required_error: 'AUTH_SECRET is required' })
    .min(16, 'AUTH_SECRET must be at least 16 characters'),
})

export type Env = z.infer<typeof envSchema>

export type EnvResult = { success: true; data: Env } | { success: false; error: string[] }

/**
 * Validate an environment object without throwing. Returns a discriminated
 * union so callers (e.g. the health surface) can report status honestly.
 */
export function parseEnv(input: Record<string, string | undefined> = process.env): EnvResult {
  const result = envSchema.safeParse(input)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    error: result.error.issues.map((issue) => issue.message),
  }
}

/**
 * Validate the environment and throw if invalid. Intended for startup paths.
 */
export function getEnv(input: Record<string, string | undefined> = process.env): Env {
  const result = parseEnv(input)
  if (!result.success) {
    throw new Error(`Invalid environment: ${result.error.join('; ')}`)
  }
  return result.data
}
