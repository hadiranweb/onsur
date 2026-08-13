import Link from 'next/link'
import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'
import { checkOpenClawHealth } from '@element-plus/application'

export const dynamic = 'force-dynamic'

export default async function MissionControl() {
  const user = await requireUser()
  const app = getApp()

  const [accesses, pending, active, recent, islands, connectors] = await Promise.all([
    app.workspaces.listForUser(user.id),
    app.runs.listPendingApprovals(user),
    app.runs.listActive(user),
    app.runs.listRecent(user),
    app.islands.listActive(),
    app.packages.listConnectors(),
  ])

  const connectorStatuses = []
  for (const connector of connectors) {
    const check = await connector.check()
    connectorStatuses.push({ id: connector.id, name: connector.name, ...check })
  }

  const openClawConfig = app.openClaw ?? {
    bin: process.env.OPENCLAW_BIN ?? 'openclaw',
    agentId: process.env.OPENCLAW_AGENT_ID ?? 'main',
    timeoutSeconds: 600,
  }
  const openclaw = (await checkOpenClawHealth(openClawConfig)).status

  return (
    <main className="mission-control">
      <h1>Mission Control</h1>
      <p>
        Welcome, {user.displayName}. Default authorization is deny — nothing external runs without
        your approval.
      </p>

      <section className="mc__section">
        <h2>Pending approvals</h2>
        {pending.length === 0 ? (
          <p>Nothing awaiting approval.</p>
        ) : (
          <ul>
            {pending.map(({ run, approval, toolCall }) => (
              <li key={approval.id}>
                <Link href={`/app/runs/${run.id}`}>
                  {toolCall?.toolName ?? approval.toolCallId} — <em>{approval.effectKind}</em>
                </Link>{' '}
                (run {run.id.slice(0, 8)})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mc__section">
        <h2>Active runs</h2>
        {active.length === 0 ? (
          <p>No active runs.</p>
        ) : (
          <ul>
            {active.map((run) => (
              <li key={run.id}>
                <Link href={`/app/runs/${run.id}`}>
                  {run.id.slice(0, 8)} — <em>{run.status}</em>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mc__section">
        <h2>Recent results</h2>
        {recent.length === 0 ? (
          <p>No finished runs yet.</p>
        ) : (
          <ul>
            {recent.slice(0, 10).map((run) => (
              <li key={run.id}>
                <Link href={`/app/runs/${run.id}`}>
                  {run.id.slice(0, 8)} — <em>{run.status}</em>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mc__section">
        <h2>Islands</h2>
        {islands.length === 0 ? (
          <p>
            No active islands. <Link href="/app/islands">Create or ensure one →</Link>
          </p>
        ) : (
          <ul>
            {islands.map((island) => (
              <li key={`${island.id}@${island.version}`}>
                <Link href={`/app/islands/${island.id}`}>{island.name}</Link> — runtime{' '}
                <em>{island.runtime.runtime}</em> (in-process)
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mc__section">
        <h2>Connections (honest status)</h2>
        <ul>
          {connectorStatuses.map((connector) => (
            <li key={connector.id}>
              {connector.name} — <em>{connector.status}</em>
            </li>
          ))}
          <li>
            OpenClaw runtime — <em>{openclaw}</em>
          </li>
        </ul>
      </section>

      <section className="mc__section">
        <h2>Your workspaces</h2>
        <ul>
          {accesses.map(({ workspace, role }) => (
            <li key={workspace.id}>
              {workspace.name} — <em>{workspace.kind}</em> — role: {role}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
