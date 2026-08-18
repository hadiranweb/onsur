import Link from 'next/link'
import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function MyAssets({ searchParams }: { searchParams: { error?: string } }) {
  const user = await requireUser()
  const mine = await getApp().assets.listMyAssets(user)

  return (
    <main>
      <h1>My Assets</h1>
      <p>
        Register, publish, install, and fork assets.{' '}
        <Link href="/app/marketplace">Browse the marketplace →</Link>
      </p>

      {searchParams.error && (
        <p role="alert" className="founder__error">
          Asset error ({searchParams.error}).
        </p>
      )}

      <form action="/api/assets" method="post" className="founder__form">
        <label>
          Kind
          <select name="kind" defaultValue="island">
            <option value="island">island</option>
            <option value="process">process</option>
            <option value="skill">skill</option>
            <option value="template">template</option>
            <option value="knowledge_package">knowledge_package</option>
            <option value="evaluation_pack">evaluation_pack</option>
            <option value="dataset">dataset</option>
          </select>
        </label>
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Description
          <textarea name="description" rows={3} required />
        </label>
        <label>
          License
          <input name="license" required placeholder="MIT" />
        </label>
        <label>
          Content reference id
          <input name="contentRefId" required placeholder="e.g. an island id" />
        </label>
        <input type="hidden" name="contentRefKind" value="island" />
        <button type="submit">Register asset</button>
      </form>

      <h2>Owned</h2>
      {mine.owned.length === 0 ? (
        <p>No owned assets.</p>
      ) : (
        <ul>
          {mine.owned.map((asset) => (
            <li key={`${asset.id}@${asset.version}`}>
              <Link href={`/app/assets/${asset.id}`}>
                {asset.name} — v{asset.version} — <em>{asset.visibility}</em>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2>Installed</h2>
      {mine.installed.length === 0 ? (
        <p>No installed assets.</p>
      ) : (
        <ul>
          {mine.installed.map(({ install, asset }) => (
            <li key={install.id}>
              {asset ? asset.name : install.assetId} — v{install.version} (installed)
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
