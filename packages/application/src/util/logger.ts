/**
 * Minimal structured logger. Writes JSON lines to stdout so logs are
 * machine-parseable. No secrets are ever logged here (callers pass sanitized
 * messages only).
 */
type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function threshold(): Level {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase()
  return raw in LEVEL_ORDER ? (raw as Level) : 'info'
}

function write(level: Level, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[threshold()]) {
    return
  }
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), level, message, ...(context ?? {}) })}\n`,
  )
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
}
