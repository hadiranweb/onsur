import Link from 'next/link'
import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function Marketplace({ searchParams }: { searchParams: { q?: string } }) {
  await requireUser()
  const query = searchParams.q ?? ''
  const assets = await getApp().assets.search(query)

  return (
    <main>
      <h1>Marketplace</h1>
      <p>Public, distributable assets. No payments or tokenomics — yet.</p>

      <form action="/app/marketplace" method="get" className="founder__form">
        <label>
          Search
          <input name="q" defaultValue={query} placeholder="name, tag, kind…" />
        </label>
        <button type="submit">Search</button>
      </form>

      {assets.length === 0 ? (
        <p>No public assets match.</p>
      ) : (
        <ul>
          {assets.map((asset) => (
            <li key={`${asset.id}@${asset.version}`}>
              <Link href={`/app/assets/${asset.id}`}>
                {asset.name} — <em>{asset.kind}</em> — v{asset.version}
              </Link>{' '}
              ({asset.license})
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
