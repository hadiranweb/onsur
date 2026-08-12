import { parseEnv } from '@element-plus/contracts'
import { getApp } from '@/lib/server/services'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type DbStatus = 'connected' | 'error' | 'not_configured'

/**
 * Local health surface. Reports liveness, environment validation, and honest
 * database connectivity (connected | error | not_configured).
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
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  )
}
