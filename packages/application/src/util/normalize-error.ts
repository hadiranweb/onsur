import type { RuntimeError } from '../ports'

/**
 * Normalize any thrown value into a stable RuntimeError shape
 * (`{ code, message }`). Used by the run engine and by runtime adapters.
 */
export function normalizeError(error: unknown): RuntimeError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return {
      code: (error as { code: string }).code,
      message: (error as { message: string }).message,
    }
  }
  if (error instanceof Error) {
    return { code: 'ENGINE_ERROR', message: error.message }
  }
  return { code: 'UNKNOWN', message: String(error) }
}
