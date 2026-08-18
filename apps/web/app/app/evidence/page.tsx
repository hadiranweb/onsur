import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function EvidenceHome({ searchParams }: { searchParams: { error?: string } }) {
  const user = await requireUser()
  const personal = await getApp().workspaces.getPersonalWorkspace(user.id)
  const evidence = personal ? await getApp().evidence.list(personal.id) : []

  return (
    <main>
      <h1>Evidence</h1>
      <p>Intake evidence; it passes a quality gate before review, and duplicates are detected.</p>

      {searchParams.error && (
        <p role="alert" className="founder__error">
          Evidence error ({searchParams.error}).
        </p>
      )}

      <form action="/api/evidence" method="post" className="founder__form">
        <label>
          Kind
          <select name="kind" defaultValue="evidence">
            <option value="evidence">evidence</option>
            <option value="assumption">assumption</option>
            <option value="unknown">unknown</option>
          </select>
        </label>
        <label>
          Content
          <textarea name="content" rows={4} required />
        </label>
        <button type="submit">Intake evidence</button>
      </form>

      <h2>Workspace evidence</h2>
      {evidence.length === 0 ? (
        <p>No evidence yet.</p>
      ) : (
        <ul>
          {evidence.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.kind}</strong> [{entry.status}]: {entry.content}
              {entry.status === 'intake' && (
                <form action={`/api/evidence/${entry.id}`} method="post">
                  <button type="submit" name="action" value="submit">
                    Submit for review
                  </button>
                </form>
              )}
              {entry.status === 'pending_review' && (
                <form
                  action={`/api/evidence/${entry.id}`}
                  method="post"
                  className="founder__actions"
                >
                  <button type="submit" name="action" value="accept">
                    Accept
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
