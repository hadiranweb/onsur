import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppError } from '@element-plus/application'
import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function AssetDetail({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string }
}) {
  const user = await requireUser()

  let asset
  try {
    asset = await getApp().assets.get(params.id)
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') {
      notFound()
    }
    throw error
  }

  const isOwner = asset.owner.id === user.id

  return (
    <main>
      <p>
        <Link href="/app/marketplace">← Marketplace</Link> ·{' '}
        <Link href="/app/assets">My Assets</Link>
      </p>
      <h1>{asset.name}</h1>
      <p>
        {asset.kind} — v{asset.version} — <em>{asset.visibility}</em> — {asset.license}
      </p>

      {searchParams.error && (
        <p role="alert" className="founder__error">
          Asset error ({searchParams.error}).
        </p>
      )}

      <p>{asset.description}</p>
      {asset.tags.length > 0 && <p>Tags: {asset.tags.join(', ')}</p>}
      <p>
        Owner: {asset.owner.id} · Content: {asset.contentRef.kind}:{asset.contentRef.id}
      </p>
      {asset.rights && (
        <p>
          Rights:{' '}
          {Object.entries(asset.rights)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}
        </p>
      )}
      <p>
        Derived from:{' '}
        {asset.provenance.derivedFrom.length > 0
          ? asset.provenance.derivedFrom.map((ref) => `${ref.kind}:${ref.id}`).join(', ')
          : '—'}
      </p>

      <div className="founder__actions">
        {isOwner && asset.visibility !== 'public' && (
          <form action={`/api/assets/${asset.id}`} method="post">
            <button type="submit" name="action" value="publish">
              Publish
            </button>
          </form>
        )}
        {asset.visibility === 'public' && !isOwner && (
          <form action={`/api/assets/${asset.id}`} method="post">
            <button type="submit" name="action" value="fork">
              Fork
            </button>
          </form>
        )}
        {(asset.visibility === 'public' || isOwner) && (
          <form action={`/api/assets/${asset.id}`} method="post">
            <button type="submit" name="action" value="install">
              Install latest
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
