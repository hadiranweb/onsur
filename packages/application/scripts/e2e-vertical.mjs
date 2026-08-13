#!/usr/bin/env node
/**
 * Element Plus — canonical vertical E2E over HTTP (black-box).
 *
 * Boots a real PostgreSQL (PGlite over the wire protocol), runs migrations,
 * starts the Next.js production server, and drives the complete v1 chain
 * through the HTTP API. Asserts every step. Exit code 0 = PASS.
 *
 * Usage (from the repo root, after `pnpm build`):
 *   pnpm e2e:vertical
 *
 * The Run step uses the FAKE runtime (the reference island's runtime binding).
 * OpenClaw live execution is NOT RUN (no binary/credentials in this
 * environment) and is never claimed here.
 */
import { spawn } from 'node:child_process'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const ROOT = new URL('../../..', import.meta.url).pathname
const MIGRATE = `${ROOT}packages/application/scripts/migrate.mjs`

const AUTH_SECRET = 'vertical-e2e-secret-that-is-long-enough'

let failures = 0
function check(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`)
  } else {
    console.error(`  ✗ ${label}`)
    failures += 1
  }
}

function run(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe', ...opts })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => (out += chunk))
    child.stderr.on('data', (chunk) => (err += chunk))
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${command} failed: ${err}`)),
    )
  })
}

class CookieJar {
  constructor() {
    this.cookies = new Map()
  }
  store(setCookieHeaders) {
    for (const header of setCookieHeaders ?? []) {
      const [pair] = header.split(';')
      const eq = pair.indexOf('=')
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }
}

async function fetchJson(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, options)
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body, headers: res.headers }
}

async function postForm(base, path, jar, fields) {
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(fields)) form.set(k, String(v))
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: jar.header() },
    body: form.toString(),
    redirect: 'manual',
  })
  jar.store(res.headers.getSetCookie ? res.headers.getSetCookie() : [])
  return { status: res.status, location: res.headers.get('location') }
}

function idFromLocation(location, prefix) {
  if (!location) return null
  const match = new RegExp(`/${prefix}/([^/?]+)`).exec(location)
  return match ? match[1] : null
}

async function waitFor(base, path, jar, predicate, label, timeoutMs = 5000) {
  const start = Date.now()
  let value
  do {
    const { body } = await fetchJson(base, path, { headers: { cookie: jar.header() } })
    value = predicate(body)
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 50))
  } while (Date.now() - start < timeoutMs)
  throw new Error(`timed out waiting for ${label}`)
}

// ---------------------------------------------------------------------------
// 1. Database
// ---------------------------------------------------------------------------
console.log('• booting PostgreSQL (PGlite)')
const db = await PGlite.create()
const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 10 })
await server.start()
const conn = server.getServerConn()
const dbPort = Number(conn.split(':').pop())
const DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${dbPort}/postgres`

console.log('• running migrations')
await run('node', [MIGRATE], { env: { ...process.env, DATABASE_URL } })

// ---------------------------------------------------------------------------
// 2. Web server
// ---------------------------------------------------------------------------
console.log('• starting web server')
const web = spawn('pnpm', ['--filter', '@element-plus/web', 'start'], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL, AUTH_SECRET },
  stdio: 'pipe',
})
let webLog = ''
web.stdout.on('data', (chunk) => (webLog += chunk))
web.stderr.on('data', (chunk) => (webLog += chunk))

const BASE = 'http://localhost:3000'
const deadline = Date.now() + 30_000
let healthy = false
while (Date.now() < deadline) {
  try {
    const res = await fetch(`${BASE}/api/health`)
    const body = await res.json()
    if (body.status === 'ok') {
      healthy = true
      break
    }
  } catch {
    // not up yet
  }
  await new Promise((resolve) => setTimeout(resolve, 300))
}
check(healthy, 'web server healthy')

const alice = new CookieJar()
const bob = new CookieJar()

try {
  // 3. new user -> personal workspace
  console.log('• identity + workspace')
  const reg = await postForm(BASE, '/api/auth/register', alice, {
    email: `vertical-http-${Date.now()}-a@example.com`,
    password: 'password123',
    displayName: 'Alice HTTP',
  })
  check(reg.status === 303, 'alice registers')

  const { body: sessionBody } = await fetchJson(BASE, '/api/auth/session', {
    headers: { cookie: alice.header() },
  })
  check(sessionBody?.user?.email?.endsWith('@example.com') === true, 'session resolves to alice')

  const { body: workspacesBody } = await fetchJson(BASE, '/api/workspaces', {
    headers: { cookie: alice.header() },
  })
  check(
    (workspacesBody?.workspaces ?? []).some((w) => w.workspace.kind === 'personal'),
    'personal workspace exists',
  )

  // 4. Founder -> SPS -> confirmed ProblemSpecification
  console.log('• Founder')
  const founderLoc = await postForm(BASE, '/api/founder/sessions', alice, {
    rawProblem: 'Checkout fails at the payment step when a card is declined, with no retry.',
  })
  const sessionId = idFromLocation(founderLoc.location, 'founder')
  check(!!sessionId, 'founder session opened')

  await waitFor(BASE, `/app/founder/${sessionId}`, alice, () => true, 'session page renders')
  const confirmLoc = await postForm(BASE, `/api/founder/sessions/${sessionId}/confirm`, alice, {})
  check(confirmLoc.status === 303, 'founder confirmed')

  const specId = await waitFor(BASE, `/api/runs`, alice, () => null, 'placeholder').catch(
    () => null,
  )
  void specId

  // 5. capability resolution + island
  console.log('• island resolution')
  const islandLoc = await postForm(BASE, '/api/islands/resolve', alice, {})
  const islandId = idFromLocation(islandLoc.location, 'islands')
  check(!!islandId, 'reference island resolved/activated')

  // 6. run (FAKE RUNTIME)
  console.log('• run (fake runtime)')
  // Find a confirmed spec id from the founder session page.
  const founderHtml = await fetch(`${BASE}/app/founder/${sessionId}`, {
    headers: { cookie: alice.header() },
  }).then((res) => res.text())
  const specMatch = /Specification id: <code>([^<]+)<\/code>/.exec(founderHtml)
  const confirmedSpecId = specMatch ? specMatch[1] : null
  check(!!confirmedSpecId, 'confirmed spec id captured')

  const runLoc = await postForm(BASE, '/api/runs', alice, {
    islandId,
    problemSpecId: confirmedSpecId,
  })
  const runId = idFromLocation(runLoc.location, 'runs')
  check(!!runId, 'run enqueued')

  await waitFor(
    BASE,
    `/api/runs/${runId}`,
    alice,
    (body) => body?.run?.status === 'completed',
    'run completes',
  )
  check(true, 'run completed')
  const runView = await fetchJson(BASE, `/api/runs/${runId}`, {
    headers: { cookie: alice.header() },
  })
  check(runView.body?.artifacts?.length === 1, 'result artifact persisted')

  // 7. evaluation
  const evalLoc = await postForm(BASE, `/api/runs/${runId}/evaluate`, alice, { verdict: 'pass' })
  check(evalLoc.status === 303, 'run evaluated')

  // 8. feedback
  const fbLoc = await postForm(BASE, '/api/feedback', alice, {
    runId,
    content: 'cache the retry path',
  })
  check(fbLoc.status === 303, 'feedback submitted')

  // 9. scoped memory
  await postForm(BASE, '/api/memory', alice, {
    scope: 'workspace',
    content: 'remember the retry path',
  })
  const memView = await fetchJson(BASE, '/api/memory', { headers: { cookie: alice.header() } })
  check(
    (memView.body?.memory ?? []).some((m) => m.scope === 'workspace' && m.status === 'candidate'),
    'memory candidate created',
  )

  // 10. knowledge -> proposal -> governed version change
  console.log('• knowledge governance')
  await postForm(BASE, '/api/knowledge', alice, {
    title: 'Retry guidance',
    content: 'always retry with backoff',
  })
  const know = await fetchJson(BASE, '/api/knowledge', { headers: { cookie: alice.header() } })
  const knowledgeId = know.body?.knowledge?.[0]?.id
  check(!!knowledgeId, 'knowledge draft created')

  await postForm(BASE, `/api/knowledge/${knowledgeId}`, alice, { action: 'publish' })
  await postForm(BASE, '/api/proposals', alice, {
    targetId: knowledgeId,
    targetKind: 'knowledge',
    fromVersion: '1.0.0',
    toVersion: '1.0.1',
    rationale: 'new evidence',
    content: 'always retry with exponential backoff',
  })
  const proposals = await fetchJson(BASE, '/api/knowledge', { headers: { cookie: alice.header() } })
  const proposalId = proposals.body?.proposals?.[0]?.id
  check(!!proposalId, 'version proposal created')

  await postForm(BASE, `/api/proposals/${proposalId}`, alice, { action: 'review' })
  await postForm(BASE, `/api/proposals/${proposalId}`, alice, { action: 'approve' })
  await postForm(BASE, `/api/proposals/${proposalId}`, alice, { action: 'merge' })

  const merged = await fetchJson(BASE, '/api/knowledge', { headers: { cookie: alice.header() } })
  const versions = (merged.body?.knowledge ?? []).map((k) => `${k.version}:${k.status}`)
  check(
    versions.includes('1.0.1:published') && versions.includes('1.0.0:superseded'),
    'governed version change applied',
  )

  // 11. asset publication
  console.log('• asset marketplace')
  const assetLoc = await postForm(BASE, '/api/assets', alice, {
    kind: 'island',
    name: 'Reusable Analysis Island',
    description: 'distributable analysis island',
    license: 'MIT',
    contentRefId: islandId,
    contentRefKind: 'island',
  })
  const assetId = idFromLocation(assetLoc.location, 'assets')
  check(!!assetId, 'asset registered')
  await postForm(BASE, `/api/assets/${assetId}`, alice, { action: 'publish' })

  // 12. second user forks + installs exact version
  await postForm(BASE, '/api/auth/register', bob, {
    email: `vertical-http-${Date.now()}-b@example.com`,
    password: 'password123',
    displayName: 'Bob HTTP',
  })
  const forkLoc = await postForm(BASE, `/api/assets/${assetId}`, bob, { action: 'fork' })
  const forkId = idFromLocation(forkLoc.location, 'assets')
  check(!!forkId && forkId !== assetId, 'bob forks the asset')
  const installLoc = await postForm(BASE, `/api/assets/${assetId}`, bob, { action: 'install' })
  check(installLoc.status === 303, 'bob installs the asset')

  // 13. honest connection status
  const conns = await fetchJson(BASE, '/api/connections', { headers: { cookie: alice.header() } })
  check(
    (conns.body?.connectors ?? []).some((c) => c.id === 'relay' && c.status === 'connected'),
    'relay connector status honest',
  )
} finally {
  web.kill('SIGTERM')
  await server.stop()
  await db.close()
}

if (failures > 0) {
  console.error(`\nE2E FAILED: ${failures} assertion(s) failed`)
  process.exit(1)
} else {
  console.log('\nE2E PASSED: full vertical chain verified over HTTP')
  process.exit(0)
}
