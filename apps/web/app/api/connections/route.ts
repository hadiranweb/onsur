import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const connectors = getApp().packages.listConnectors()
  const statuses = []
  for (const connector of connectors) {
    const check = await connector.check()
    statuses.push({ id: connector.id, name: connector.name, ...check })
  }
  const outbox = await getApp().packages.getOutbox()
  return NextResponse.json({ connectors: statuses, outbox })
}
