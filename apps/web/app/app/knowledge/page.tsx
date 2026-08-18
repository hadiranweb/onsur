import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function KnowledgeHome({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const user = await requireUser()
  const personal = await getApp().workspaces.getPersonalWorkspace(user.id)
  const knowledge = personal ? await getApp().knowledge.list(personal.id) : []
  const proposals = await getApp().proposals.list()

  return (
    <main>
      <h1>Knowledge</h1>
      <p>Governed, versioned knowledge. Changes flow through a VersionProposal review.</p>

      {searchParams.error && (
        <p role="alert" className="founder__error">
          Knowledge error ({searchParams.error}).
        </p>
      )}

      <form action="/api/knowledge" method="post" className="founder__form">
        <label>
          Title
          <input name="title" required />
        </label>
        <label>
          Content
          <textarea name="content" rows={4} required />
        </label>
        <button type="submit">Create draft knowledge</button>
      </form>

      <h2>Knowledge (latest versions)</h2>
      {knowledge.length === 0 ? (
        <p>No knowledge yet.</p>
      ) : (
        <ul>
          {knowledge.map((entry) => (
            <li key={`${entry.id}@${entry.version}`}>
              <strong>{entry.title}</strong> — v{entry.version} [{entry.status}]: {entry.content}
              {entry.status === 'draft' && (
                <form action={`/api/knowledge/${entry.id}`} method="post">
                  <button type="submit" name="action" value="publish">
                    Publish
                  </button>
                </form>
              )}
              <form action="/api/proposals" method="post" className="founder__form">
                <input type="hidden" name="targetId" value={entry.id} />
                <input type="hidden" name="targetKind" value="knowledge" />
                <input type="hidden" name="fromVersion" value={entry.version} />
                <label>
                  Next version
                  <input name="toVersion" defaultValue={bump(entry.version)} required />
                </label>
                <label>
                  Proposed content
                  <textarea name="content" rows={2} required />
                </label>
                <label>
                  Rationale
                  <input name="rationale" required />
                </label>
                <button type="submit">Propose version change</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h2>Version proposals</h2>
      {proposals.length === 0 ? (
        <p>No proposals yet.</p>
      ) : (
        <ul>
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              {proposal.target.kind}:{proposal.target.id.slice(0, 8)} — {proposal.fromVersion} →{' '}
              {proposal.toVersion} [{proposal.status}]: {proposal.rationale}
              <form
                action={`/api/proposals/${proposal.id}`}
                method="post"
                className="founder__actions"
              >
                {proposal.status === 'proposed' && (
                  <button type="submit" name="action" value="review">
                    Review
                  </button>
                )}
                {proposal.status === 'under_review' && (
                  <>
                    <button type="submit" name="action" value="approve">
                      Approve
                    </button>
                    <button type="submit" name="action" value="reject">
                      Reject
                    </button>
                  </>
                )}
                {proposal.status === 'approved' && (
                  <button type="submit" name="action" value="merge">
                    Merge
                  </button>
                )}
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function bump(version: string): string {
  const [major, minor, patch] = version.split('.').map(Number) as [number, number, number]
  return `${major}.${minor}.${patch + 1}`
}
