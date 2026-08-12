import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function AppHome() {
  const user = await requireUser()
  const accesses = await getApp().workspaces.listForUser(user.id)

  return (
    <main className="app-home">
      <h1>Welcome, {user.displayName}</h1>
      <h2>Your workspaces</h2>
      {accesses.length === 0 ? (
        <p>You have no workspaces.</p>
      ) : (
        <ul>
          {accesses.map(({ workspace, role }) => (
            <li key={workspace.id}>
              {workspace.name} — <em>{workspace.kind}</em> — role: {role}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
