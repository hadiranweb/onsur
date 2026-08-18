import Link from 'next/link'
import type { SpsSessionRecord } from '@element-plus/application'
import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function FounderHome({ searchParams }: { searchParams: { error?: string } }) {
  const user = await requireUser()
  const personal = await getApp().workspaces.getPersonalWorkspace(user.id)

  let sessions: SpsSessionRecord[] = []
  if (personal) {
    sessions = await getApp().founder.list(user, personal.id)
  }

  return (
    <main>
      <h1>Founder</h1>
      <p className="founder__fa" lang="fa" dir="rtl">
        بیان مسئله ساخت‌یافته
      </p>
      <p>State a raw problem. Founder turns it into a structured, confirmable understanding.</p>

      {searchParams.error && (
        <p role="alert" className="founder__error">
          {searchParams.error === 'empty'
            ? 'Please state a problem.'
            : `Founder error (${searchParams.error}).`}
        </p>
      )}

      <form action="/api/founder/sessions" method="post" className="founder__form">
        <label>
          Raw problem
          <textarea
            name="rawProblem"
            rows={5}
            required
            placeholder="Describe the problem in your own words…"
          />
        </label>
        <button type="submit">Start structuring</button>
      </form>

      <h2>Your SPS sessions</h2>
      {sessions.length === 0 ? (
        <p>No sessions yet.</p>
      ) : (
        <ul>
          {sessions.map((session) => (
            <li key={session.id}>
              <Link href={`/app/founder/${session.id}`}>
                {session.id.slice(0, 8)} — {session.status}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
