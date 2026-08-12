import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppError } from '@element-plus/application'
import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function IslandDetail({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { reused?: string }
}) {
  await requireUser()

  let island
  try {
    island = await getApp().islands.get(params.id)
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') {
      notFound()
    }
    throw error
  }

  return (
    <main>
      <p>
        <Link href="/app/islands">← Back to Islands</Link>
      </p>
      <h1>{island.name}</h1>
      <p>
        Version: <strong>v{island.version}</strong> — Status: <strong>{island.status}</strong>
      </p>

      {searchParams.reused === 'true' && (
        <p className="founder__reused">Reused an existing compatible island.</p>
      )}

      <p>{island.description}</p>

      <h2>Capabilities</h2>
      <ul>
        {island.capabilities.map((capability) => (
          <li key={capability.id}>
            {capability.id} ({capability.kind})
          </li>
        ))}
      </ul>

      <h2>Runtime binding</h2>
      <p>
        {island.runtime.runtime}
        {island.runtime.adapterVersion ? ` @ ${island.runtime.adapterVersion}` : ''}
      </p>

      {island.permissions.length > 0 && (
        <>
          <h2>Permissions</h2>
          <ul>
            {island.permissions.map((permission) => (
              <li key={permission}>{permission}</li>
            ))}
          </ul>
        </>
      )}

      <h2>Provenance</h2>
      <p>
        Reason: {island.provenance.reason}
        {island.provenance.derivedFrom.length > 0 && (
          <>
            {' '}
            — derived from:{' '}
            {island.provenance.derivedFrom.map((ref) => `${ref.kind}:${ref.id}`).join(', ')}
          </>
        )}
      </p>
    </main>
  )
}
