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
  const personal = await getApp().workspaces.getPersonalWorkspace(user.id)
  const knowledge = personal ? await getApp().knowledge.list(personal.id) : []
  const proposals = await getApp().proposals.list()
  return NextResponse.json({ knowledge, proposals })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const personal = await getApp().workspaces.getPersonalWorkspace(user.id)
  if (!personal) {
    return NextResponse.json({ error: 'no_workspace' }, { status: 409 })
  }

  const form = await request.formData()
  const title = String(form.get('title') ?? '').trim()
  const content = String(form.get('content') ?? '').trim()

  try {
    await getApp().knowledge.createDraft({
      workspaceId: personal.id,
      ownerId: user.id,
      title,
      content,
      actorUserId: user.id,
    })
    return NextResponse.redirect(new URL('/app/knowledge', request.url), 303)
  } catch (error) {
    if (error instanceof AppError) {
      const url = new URL('/app/knowledge', request.url)
      url.searchParams.set('error', error.code.toLowerCase())
      return NextResponse.redirect(url, 303)
    }
    throw error
  }
}
