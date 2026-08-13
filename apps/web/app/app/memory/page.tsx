import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function MemoryHome({ searchParams }: { searchParams: { error?: string } }) {
  const user = await requireUser()
  const memory = await getApp().memory.listForUser(user.id)

  return (
    <main>
      <h1>Memory</h1>
      <p>Scoped memory entries. Runtime output is always a candidate until promoted.</p>

      {searchParams.error && (
        <p role="alert" className="founder__error">
          Memory error ({searchParams.error}).
        </p>
      )}

      <form action="/api/memory" method="post" className="founder__form">
        <label>
          Content
          <textarea name="content" rows={3} required />
        </label>
        <label>
          Scope
          <select name="scope" defaultValue="workspace">
            <option value="private">private</option>
            <option value="workspace">workspace</option>
            <option value="shared">shared</option>
          </select>
        </label>
        <button type="submit">Create candidate</button>
      </form>

      <h2>Your memory</h2>
      {memory.length === 0 ? (
        <p>No memory yet.</p>
      ) : (
        <ul>
          {memory.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.scope}</strong> [{entry.status}]: {entry.content}
              {entry.status === 'candidate' && (
                <form action={`/api/memory/${entry.id}`} method="post" className="founder__actions">
                  <button type="submit" name="action" value="promote">
                    Promote
                  </button>
                  <button type="submit" name="action" value="reject">
                    Reject
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
