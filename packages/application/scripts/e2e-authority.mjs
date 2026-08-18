#!/usr/bin/env node
/**
 * R0 black-box authority regression (two real users/workspaces over HTTP).
 *
 * Reproduces the audit exploit pattern and asserts it now FAILS CLOSED:
 *   - foreign ProblemSpecification Run create  -> denied
 *   - foreign Run read (and therefore events)  -> 404
 *   - foreign Run cancel                        -> denied (state unchanged)
 *   - foreign approval decision                 -> denied (still pending)
 * and the positive path still works for the authorized owner.
 *
 * Usage: pnpm e2e:authority   (after `pnpm build`)
 */
import { spawn } from 'node:child_process'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const ROOT = new URL('../../..', import.meta.url).pathname
const MIGRATE = `${ROOT}packages/application/scripts/migrate.mjs`
const AUTH_SECRET = 'authority-e2e-secret-that-is-long-enough'

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

async function getJson(base, path, jar) {
  const res = await fetch(`${base}${path}`, { headers: { cookie: jar.header() } })
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

function idFromLocation(location, prefix) {
  if (!location) return null
  const match = new RegExp(`/${prefix}/([^/?]+)`).exec(location)
  return match ? match[1] : null
}

// 1. Database
console.log('• booting PostgreSQL (PGlite)')
const db = await PGlite.create()
const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1', maxConnections: 10 })
await server.start()
const dbPort = Number(server.getServerConn().split(':').pop())
const DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${dbPort}/postgres`

console.log('• running migrations')
await run('node', [MIGRATE], { env: { ...process.env, DATABASE_URL } })

// 2. Web server
console.log('• starting web server')
const web = spawn('pnpm', ['--filter', '@element-plus/web', 'start'], {
  cwd: ROOT,
  env: { ...process.env, DATABASE_URL, AUTH_SECRET },
  stdio: 'pipe',
})
const BASE = 'http://localhost:3000'
const deadline = Date.now() + 30_000
let healthy = false
while (Date.now() < deadline) {
  try {
    const res = await fetch(`${BASE}/api/health`)
    if ((await res.json()).status === 'ok') {
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
  // 3. Register two users.
  await postForm(BASE, '/api/auth/register', alice, {
    email: `auth-a-${Date.now()}@example.com`,
    password: 'password123',
    displayName: 'Alice',
  })
  await postForm(BASE, '/api/auth/register', bob, {
    email: `auth-b-${Date.now()}@example.com`,
    password: 'password123',
    displayName: 'Bob',
  })

  // 4. Alice: controlled-action island + confirmed spec + a paused run.
  await postForm(BASE, '/api/islands/controlled-action', alice, {})
  const founderLoc = await postForm(BASE, '/api/founder/sessions', alice, {
    rawProblem: 'Authority exploit reproduction problem.',
  })
  const sessionId = idFromLocation(founderLoc.location, 'founder')
  await postForm(BASE, `/api/founder/sessions/${sessionId}/confirm`, alice, {})

  const founderHtml = await fetch(`${BASE}/app/founder/${sessionId}`, {
    headers: { cookie: alice.header() },
  }).then((res) => res.text())
  const specId = /Specification id: <code>([^<]+)<\/code>/.exec(founderHtml)?.[1] ?? null
  check(!!specId, 'alice confirmed a ProblemSpecification')

  const islandsJson = await getJson(BASE, '/api/islands', alice)
  const controlled = (islandsJson.body?.islands ?? []).find(
    (i) => i.name === 'Controlled Action Island',
  )
  check(!!controlled, 'controlled action island active')

  // 5. Alice enqueues a run (pauses at awaiting_approval).
  const runLoc = await postForm(BASE, '/api/runs', alice, {
    islandId: controlled.id,
    problemSpecId: specId,
  })
  const runId = idFromLocation(runLoc.location, 'runs')
  check(!!runId, 'alice enqueued a run')

  let runStatus = null
  for (let i = 0; i < 20; i++) {
    const view = await getJson(BASE, `/api/runs/${runId}`, alice)
    runStatus = view.body?.run?.status ?? null
    if (runStatus === 'awaiting_approval') break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  check(runStatus === 'awaiting_approval', 'alice run paused awaiting_approval')

  // 6. Exploit attempts by Bob.
  console.log('• foreign-access exploit attempts (expected: denied)')

  const foreignCreate = await postForm(BASE, '/api/runs', bob, {
    islandId: controlled.id,
    problemSpecId: specId,
  })
  check(
    foreignCreate.location?.includes('error=forbidden') === true,
    'foreign ProblemSpecification Run create denied',
  )

  const foreignRead = await getJson(BASE, `/api/runs/${runId}`, bob)
  check(foreignRead.status === 404, `foreign Run read denied (got ${foreignRead.status})`)

  const foreignCancel = await postForm(BASE, `/api/runs/${runId}/cancel`, bob, {})
  check(foreignCancel.location?.includes('error=forbidden') === true, 'foreign Run cancel denied')

  const afterCancel = await getJson(BASE, `/api/runs/${runId}`, alice)
  check(
    afterCancel.body?.run?.status === 'awaiting_approval',
    'alice run unchanged after foreign cancel',
  )

  const aliceApproval = (await getJson(BASE, `/api/runs/${runId}`, alice)).body?.approvals?.find(
    (a) => a.status === 'pending',
  )
  check(!!aliceApproval, 'approval still pending for alice')

  const foreignApprove = await postForm(
    BASE,
    `/api/runs/${runId}/approvals/${aliceApproval?.id}`,
    bob,
    { decision: 'approve' },
  )
  check(
    foreignApprove.location?.includes('error=forbidden') === true,
    'foreign approval decision denied',
  )

  const stillPending = (await getJson(BASE, `/api/runs/${runId}`, alice)).body?.approvals?.find(
    (a) => a.id === aliceApproval?.id,
  )
  check(stillPending?.status === 'pending', 'approval still pending after foreign decision')

  // 7. Unauthenticated attempts.
  const anonRead = await fetch(`${BASE}/api/runs/${runId}`)
  check(anonRead.status === 401, `unauthenticated run read denied (got ${anonRead.status})`)
  const anonCreate = await fetch(`${BASE}/api/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `islandId=${controlled.id}&problemSpecId=${specId}`,
    redirect: 'manual',
  })
  check(anonCreate.status === 401, `unauthenticated run create denied (got ${anonCreate.status})`)

  // 8. Positive: Alice approves and the effect executes exactly once.
  await postForm(BASE, `/api/runs/${runId}/approvals/${aliceApproval?.id}`, alice, {
    decision: 'approve',
  })
  for (let i = 0; i < 20; i++) {
    const view = await getJson(BASE, `/api/runs/${runId}`, alice)
    if (view.body?.run?.status === 'completed') break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const done = await getJson(BASE, `/api/runs/${runId}`, alice)
  check(done.body?.run?.status === 'completed', 'alice run completed after approval')
  check((done.body?.effects ?? []).length === 1, 'exactly one effect recorded')
} finally {
  web.kill('SIGTERM')
  await server.stop()
  await db.close()
}

if (failures > 0) {
  console.error(`\nAUTHORITY E2E FAILED: ${failures} assertion(s) failed`)
  process.exit(1)
} else {
  console.log('\nAUTHORITY E2E PASSED: cross-workspace execution access fails closed')
  process.exit(0)
}
