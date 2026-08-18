import { spawn } from 'node:child_process'
import type { OpenClawCliConfig } from './cli'

export type OpenClawHealthStatus = 'connected' | 'error' | 'not_configured'

export interface OpenClawHealthResult {
  status: OpenClawHealthStatus
  detail?: string
}

/**
 * Health check through the documented `openclaw health --json --timeout <ms>`
 * CLI. Never claims connectivity merely because a binary or secret exists.
 */
export async function checkOpenClawHealth(
  config: OpenClawCliConfig,
): Promise<OpenClawHealthResult> {
  return new Promise((resolve) => {
    const child = spawn(config.bin, ['health', '--json', '--timeout', '3000'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    let settled = false

    const finish = (status: OpenClawHealthStatus, detail?: string) => {
      if (settled) return
      settled = true
      resolve({ status, detail })
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish('error', 'openclaw health timed out')
    }, 5000)

    child.on('error', (error) => {
      clearTimeout(timer)
      const notConfigured = (error as NodeJS.ErrnoException).code === 'ENOENT'
      finish(
        notConfigured ? 'not_configured' : 'error',
        notConfigured ? 'openclaw binary not found' : error.message,
      )
    })

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        finish('connected')
      } else {
        finish('error', stderr.trim() || `openclaw health exited with code ${code}`)
      }
    })
  })
}
