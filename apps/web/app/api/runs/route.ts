import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const runs = await getApp().runs.list()
  return NextResponse.json({ runs })
}

/** Start a run from a form: islandId + problemSpecId (+ optional processId). */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const form = await request.formData()
  const islandId = String(form.get('islandId') ?? '').trim()
  const problemSpecId = String(form.get('problemSpecId') ?? '').trim()
  const processId = String(form.get('processId') ?? '').trim()

  try {
    const run = await getApp().runs.enqueue({
      actorUserId: user.id,
      islandId,
      problemSpecId,
      processId: processId || undefined,
    })
    return NextResponse.redirect(new URL(`/app/runs/${run.id}`, request.url), 303)
  } catch (error) {
    if (error instanceof AppError) {
      const url = new URL('/app/runs', request.url)
      url.searchParams.set('error', error.code.toLowerCase())
      return NextResponse.redirect(url, 303)
    }
    throw error
  }
}
