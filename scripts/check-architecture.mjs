#!/usr/bin/env node
/**
 * Architecture guard: enforces the Element Plus layer boundaries.
 *
 * - Verifies every workspace package is a known package with an allowed set of
 *   internal (workspace) dependencies.
 * - Verifies the pure layers (`@element-plus/domain`, `@element-plus/contracts`)
 *   have no forbidden framework/runtime dependencies (Next.js, React,
 *   PostgreSQL drivers, OpenClaw, LLM/provider SDKs).
 *
 * Run via `pnpm check:arch`. Exits non-zero on any violation.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Allowed internal (workspace) dependencies, keyed by package name. */
const ALLOWED_INTERNAL = {
  '@element-plus/domain': [],
  '@element-plus/contracts': [],
  '@element-plus/application': ['@element-plus/domain', '@element-plus/contracts'],
  '@element-plus/web': [
    '@element-plus/domain',
    '@element-plus/contracts',
    '@element-plus/application',
  ],
}

/**
 * Runtime packages that must never appear as dependencies of the pure layers
 * (`domain`, `contracts`).
 */
const FORBIDDEN_RUNTIME = [
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

const DEP_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

function listPackages() {
  const packages = []
  for (const base of ['apps', 'packages']) {
    const dir = join(root, base)
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir)) {
      const pkgPath = join(dir, entry, 'package.json')
      if (!existsSync(pkgPath)) continue
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      packages.push({ dir: join(dir, entry), ...pkg })
    }
  }
  return packages
}

function collectDeps(pkg) {
  const deps = {}
  for (const section of DEP_SECTIONS) {
    for (const [name, range] of Object.entries(pkg[section] ?? {})) {
      deps[name] = { range, section }
    }
  }
  return deps
}

function isForbiddenRuntime(name) {
  return FORBIDDEN_RUNTIME.some((m) => name === m || name.startsWith(`${m}/`))
}

const packages = listPackages()
const errors = []

if (packages.length === 0) {
  process.stdout.write('FAIL: no workspace packages discovered under apps/* and packages/*\n')
  process.exit(1)
}

for (const pkg of packages) {
  const allowed = ALLOWED_INTERNAL[pkg.name]
  if (!allowed) {
    errors.push(`${pkg.name}: unknown workspace package (not in architecture guard allow-list)`)
    continue
  }

  const deps = collectDeps(pkg)
  for (const [dep, meta] of Object.entries(deps)) {
    const isInternal = dep.startsWith('@element-plus/')
    if (isInternal && !allowed.includes(dep)) {
      errors.push(
        `${pkg.name}: internal dependency ${dep} (${meta.section}) is not allowed — allowed: ${allowed.join(', ') || '(none)'}`,
      )
    }
    const pureLayer = pkg.name === '@element-plus/domain' || pkg.name === '@element-plus/contracts'
    const runtimeSection = meta.section === 'dependencies' || meta.section === 'peerDependencies'
    if (pureLayer && runtimeSection && (isInternal || isForbiddenRuntime(dep))) {
      errors.push(
        `${pkg.name}: forbidden runtime dependency ${dep} (${meta.section}) — pure layers must not depend on frameworks/runtime/other packages`,
      )
    }
  }
}

if (errors.length > 0) {
  process.stdout.write('FAIL: architecture guard violations:\n')
  for (const error of errors) process.stdout.write(`  - ${error}\n`)
  process.exit(1)
}

process.stdout.write(
  `PASS: architecture guard (${packages.length} packages, ${Object.keys(ALLOWED_INTERNAL).length} boundaries)\n`,
)
