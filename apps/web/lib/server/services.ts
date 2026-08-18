import { createAppServices, logger } from '@element-plus/application'
import type { AppServices } from '@element-plus/application'
import { getEnv } from '@element-plus/contracts'

/**
 * Server-only composition root. A single pg pool + service graph is shared
 * across requests (guarded against hot-reload duplication via globalThis).
 * Stale-run recovery runs once on startup.
 */
const globalStore = globalThis as unknown as {
  __elementPlusApp?: AppServices
  __elementPlusRecovery?: boolean
}

export function getApp(): AppServices {
  if (!globalStore.__elementPlusApp) {
    const env = getEnv()
    globalStore.__elementPlusApp = createAppServices({
      databaseUrl: env.DATABASE_URL,
      authSecret: env.AUTH_SECRET,
    })
  }
  if (!globalStore.__elementPlusRecovery) {
    globalStore.__elementPlusRecovery = true
    void globalStore.__elementPlusApp.runs
      .recoverStaleRuns()
      .then((count) => {
        if (count > 0) {
          logger.warn('recovered stale runs on startup', { count })
        }
      })
      .catch((error) => logger.error('stale-run recovery failed', { error: String(error) }))
  }
  return globalStore.__elementPlusApp
}
