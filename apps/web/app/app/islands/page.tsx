import Link from 'next/link'
import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function IslandsHome({ searchParams }: { searchParams: { error?: string } }) {
  await requireUser()
  const islands = await getApp().islands.list()

  return (
    <main>
      <h1>Islands</h1>
      <p>Reusable, versioned units that bind capabilities to a runtime.</p>

      {searchParams.error && (
        <p role="alert" className="founder__error">
          Island error ({searchParams.error}).
        </p>
      )}

      <form action="/api/islands/resolve" method="post" className="founder__actions">
        <button type="submit">Ensure Structured Analysis Island (reuse before create)</button>
      </form>

      <form action="/api/islands" method="post" className="founder__form">
        <label>
          Name
          <input name="name" required placeholder="My Island" />
        </label>
        <label>
          Description
          <textarea name="description" rows={3} required placeholder="What does this island do?" />
        </label>
        <button type="submit">Create draft island</button>
      </form>

      <h2>Registry</h2>
      {islands.length === 0 ? (
        <p>No islands yet.</p>
      ) : (
        <ul>
          {islands.map((island) => (
            <li key={`${island.id}@${island.version}`}>
              <Link href={`/app/islands/${island.id}`}>
                {island.name} — v{island.version} — <em>{island.status}</em>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
