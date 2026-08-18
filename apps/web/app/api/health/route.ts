import { checkOpenClawHealth } from '@element-plus/application'
import { parseEnv } from '@element-plus/contracts'
import { getApp } from '@/lib/server/services'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type DbStatus = 'connected' | 'error' | 'not_configured'
type OpenClawStatus = 'connected' | 'error' | 'not_configured'

/**
 * Local health surface. Reports liveness, environment validation, and honest
 * connectivity for PostgreSQL and OpenClaw (connected | error | not_configured).
 * A configured secret or binary is never reported as "connected" — only a live
 * probe result counts.
 */
export async function GET() {
  const envResult = parseEnv(process.env)

  let database: DbStatus = 'not_configured'
  if (envResult.success) {
    try {
      const app = getApp()
      await app.pool.query('SELECT 1')
      database = 'connected'
    } catch {
      database = 'error'
    }
  }

  let openclaw: OpenClawStatus = 'not_configured'
  if (envResult.success) {
    const app = getApp()
    const config = app.openClaw ?? {
      bin: process.env.OPENCLAW_BIN ?? 'openclaw',
      agentId: process.env.OPENCLAW_AGENT_ID ?? 'main',
      timeoutSeconds: 600,
    }
    openclaw = (await checkOpenClawHealth(config)).status
  }

  const healthy = envResult.success && database === 'connected'

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'element-plus-web',
      version: '0.1.0',
      nodeEnv: envResult.success ? envResult.data.NODE_ENV : undefined,
      env: {
        valid: envResult.success,
        issues: envResult.success ? [] : envResult.error,
      },
      database,
      openclaw,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  )
}
