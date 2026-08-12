import { createAppServices } from '@element-plus/application'
import type { AppServices } from '@element-plus/application'
import { getEnv } from '@element-plus/contracts'

/**
 * Server-only composition root. A single pg pool + service graph is shared
 * across requests (guarded against hot-reload duplication via globalThis).
 */
const globalStore = globalThis as unknown as { __elementPlusApp?: AppServices }

export function getApp(): AppServices {
  if (!globalStore.__elementPlusApp) {
    const env = getEnv()
    globalStore.__elementPlusApp = createAppServices({
      databaseUrl: env.DATABASE_URL,
      authSecret: env.AUTH_SECRET,
    })
  }
  return globalStore.__elementPlusApp
}
