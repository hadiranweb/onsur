import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Domain layer boundary enforcement.
 *
 * The domain layer must be free of framework/runtime dependencies (Next.js,
 * React, PostgreSQL drivers, OpenClaw, LLM/provider SDKs). It may depend on
 * `@element-plus/contracts` for *types only*.
 */

const FORBIDDEN_MODULES = [
  'next',
  'react',
  'react-dom',
  'pg',
  'postgres',
  '@neondatabase/serverless',
  'openclaw',
  '@anthropic-ai/sdk',
  'openai',
  'drizzle-orm',
  'kysely',
  'prisma',
  '@prisma/client',
]

const ALLOWED_INTERNAL = ['@element-plus/contracts']

const testDir = dirname(fileURLToPath(import.meta.url)) // src/__tests__
const srcDir = resolve(testDir, '..') // src
const packageDir = resolve(srcDir, '..') // packages/domain

function collectSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(full))
    } else if (entry.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

const SPECIFIER_RE = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)(['"])([^'"]+)\1/g

function isForbiddenRuntime(specifier: string): boolean {
  return FORBIDDEN_MODULES.some(
    (module) => specifier === module || specifier.startsWith(`${module}/`),
  )
}

function isForbiddenInternal(specifier: string): boolean {
  return specifier.startsWith('@element-plus/') && !ALLOWED_INTERNAL.includes(specifier)
}

describe('domain layer dependency boundaries', () => {
  const files = collectSourceFiles(srcDir).filter((file) => !file.includes('__tests__'))

  it('contains source files to guard', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('has no forbidden framework/runtime import specifiers', () => {
    const violations: string[] = []
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      for (const match of content.matchAll(SPECIFIER_RE)) {
        const specifier = match[2] ?? ''
        if (isForbiddenRuntime(specifier)) {
          violations.push(`${file}: imports forbidden runtime module "${specifier}"`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('has no internal imports other than @element-plus/contracts', () => {
    const violations: string[] = []
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      for (const match of content.matchAll(SPECIFIER_RE)) {
        const specifier = match[2] ?? ''
        if (isForbiddenInternal(specifier)) {
          violations.push(`${file}: imports forbidden internal module "${specifier}"`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('imports @element-plus/contracts for types only (never as a value)', () => {
    const violations: string[] = []
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (line.includes('@element-plus/contracts') && line.includes('import')) {
          if (!/import\s+type\b/.test(line)) {
            violations.push(
              `${file}:${index + 1} value-imports @element-plus/contracts (type-only allowed): ${line.trim()}`,
            )
          }
        }
      })
    }
    expect(violations).toEqual([])
  })

  it('declares no forbidden runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
    const sections = [
      pkg.dependencies ?? {},
      pkg.peerDependencies ?? {},
      pkg.optionalDependencies ?? {},
    ]
    const violations: string[] = []
    for (const section of sections) {
      for (const name of Object.keys(section)) {
        if (isForbiddenRuntime(name) || isForbiddenInternal(name)) {
          violations.push(`runtime dependency "${name}" is forbidden in domain`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
