import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function ConnectionsHome() {
  await requireUser()
  const connectors = getApp().packages.listConnectors()
  const statuses = []
  for (const connector of connectors) {
    const check = await connector.check()
    statuses.push({ id: connector.id, name: connector.name, ...check })
  }
  const outbox = await getApp().packages.getOutbox()

  return (
    <main>
      <h1>Connections</h1>
      <p>Honest connector status — a configured secret is never reported as connected.</p>

      <h2>Connectors</h2>
      <ul>
        {statuses.map((connector) => (
          <li key={connector.id}>
            <strong>{connector.name}</strong> ({connector.id}) — <em>{connector.status}</em>
            {connector.detail ? ` — ${connector.detail}` : ''}
          </li>
        ))}
      </ul>

      <form action="/api/outbox" method="post" className="founder__actions">
        <button type="submit">Run delivery pass</button>
      </form>

      <h2>Outbox</h2>
      {outbox.length === 0 ? (
        <p>No outbox messages.</p>
      ) : (
        <ul>
          {outbox.map((message) => (
            <li key={message.id}>
              {message.kind} → {message.connectorId} [{message.status}] — corr{' '}
              {message.correlationId}
              {message.error ? ` — ${message.error}` : ''}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
