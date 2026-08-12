import Link from 'next/link'
import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function RunsHome({ searchParams }: { searchParams: { error?: string } }) {
  await requireUser()
  const [runs, islands] = await Promise.all([getApp().runs.list(), getApp().islands.listActive()])

  return (
    <main>
      <h1>Runs</h1>
      <p>Execute an active Island against a confirmed ProblemSpecification.</p>

      {searchParams.error && (
        <p role="alert" className="founder__error">
          Run error ({searchParams.error}).
        </p>
      )}

      <form action="/api/runs" method="post" className="founder__form">
        <label>
          Island
          <select name="islandId" required>
            <option value="">Select an active island…</option>
            {islands.map((island) => (
              <option key={`${island.id}@${island.version}`} value={island.id}>
                {island.name} (v{island.version})
              </option>
            ))}
          </select>
        </label>
        <label>
          ProblemSpecification id
          <input name="problemSpecId" required placeholder="confirmed spec id (from Founder)" />
        </label>
        <label>
          Process id (optional)
          <input name="processId" placeholder="optional process id" />
        </label>
        <button type="submit">Start run</button>
      </form>

      <h2>Run history</h2>
      {runs.length === 0 ? (
        <p>No runs yet.</p>
      ) : (
        <ul>
          {runs.map((run) => (
            <li key={run.id}>
              <Link href={`/app/runs/${run.id}`}>
                {run.id.slice(0, 8)} — <em>{run.status}</em>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
