import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Sprint 00 acceptance: the domain layer has no forbidden framework/runtime
 * imports (Next.js, React, PostgreSQL drivers, OpenClaw, LLM/provider SDKs)
 * and does not depend on any other workspace package.
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
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

const SPECIFIER_RE = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)(['"])([^'"]+)\1/g

function isForbidden(specifier: string): boolean {
  return (
    specifier.startsWith('@element-plus/') ||
    FORBIDDEN_MODULES.some((module) => specifier === module || specifier.startsWith(`${module}/`))
  )
}

describe('domain layer dependency boundaries', () => {
  const files = collectSourceFiles(srcDir)

  it('contains source files to guard', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('has no forbidden framework/runtime import specifiers', () => {
    const violations: string[] = []
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      for (const match of content.matchAll(SPECIFIER_RE)) {
        const specifier = match[2] ?? ''
        if (isForbidden(specifier)) {
          violations.push(`${file}: imports forbidden module "${specifier}"`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('declares no forbidden or internal runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
    const sections = [
      pkg.dependencies ?? {},
      pkg.peerDependencies ?? {},
      pkg.optionalDependencies ?? {},
    ]
    const violations: string[] = []
    for (const section of sections) {
      for (const name of Object.keys(section)) {
        if (isForbidden(name)) {
          violations.push(`runtime dependency "${name}" is forbidden in domain`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
