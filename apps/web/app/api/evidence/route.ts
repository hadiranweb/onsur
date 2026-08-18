import { NextResponse } from 'next/server'
import { evidenceKindSchema } from '@element-plus/contracts'
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
  if (!personal) {
    return NextResponse.json({ evidence: [] })
  }
  const evidence = await getApp().evidence.list(personal.id)
  return NextResponse.json({ evidence })
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
  const kind = evidenceKindSchema.safeParse(form.get('kind'))
  const content = String(form.get('content') ?? '').trim()

  if (!kind.success || !content) {
    return redirectBack(request, '?error=invalid_input')
  }

  try {
    await getApp().evidence.intake({
      workspaceId: personal.id,
      kind: kind.data,
      content,
      actorUserId: user.id,
    })
    return NextResponse.redirect(new URL(`/app/evidence`, request.url), 303)
  } catch (error) {
    if (error instanceof AppError) {
      return redirectBack(request, `?error=${error.code.toLowerCase()}`)
    }
    throw error
  }
}

function redirectBack(request: Request, query: string) {
  const url = new URL('/app/evidence', request.url)
  url.search = query
  return NextResponse.redirect(url, 303)
}
