import { z } from 'zod'

/**
 * The environment contract for Element Plus runtimes.
 *
 * In Sprint 00 only `NODE_ENV` is validated; `DATABASE_URL` and `AUTH_SECRET`
 * are declared (optional) and become required from Sprint 02 onward.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
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
