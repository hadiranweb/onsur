import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

/** One delivery pass over the outbox (database-backed job delivery). */
export async function POST() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const delivered = await getApp().packages.deliverPending(50)
  return NextResponse.json({ delivered })
}

/** Emit a package command through the relay connector. */
export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const payload = (body as { payload?: Record<string, unknown> })?.payload ?? {}

  try {
    const message = await getApp().packages.publish({
      kind: 'command',
      connectorId: 'relay',
      payload,
      actorUserId: user.id,
    })
    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.code.toLowerCase() }, { status: error.status })
    }
    throw error
  }
}
