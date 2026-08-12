import { parseEnv } from '@element-plus/contracts'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Local health surface. Reports service liveness and the environment
 * validation status honestly (`ok` vs `degraded`).
 */
export function GET() {
  const result = parseEnv(process.env)

  const body = {
    status: result.success ? 'ok' : 'degraded',
    service: 'element-plus-web',
    version: '0.1.0',
    nodeEnv: result.success ? result.data.NODE_ENV : undefined,
    env: {
      valid: result.success,
      issues: result.success ? [] : result.error,
    },
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(body, { status: result.success ? 200 : 503 })
}
