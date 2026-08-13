import { NextResponse } from 'next/server'
import { memoryScopeSchema } from '@element-plus/contracts'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const memory = await getApp().memory.listForUser(user.id)
  return NextResponse.json({ memory })
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
  const scope = memoryScopeSchema.safeParse(form.get('scope'))
  const content = String(form.get('content') ?? '').trim()

  if (!scope.success || !content) {
    return redirectBack(request, '?error=invalid_input')
  }

  try {
    await getApp().memory.createCandidate({
      workspaceId: personal.id,
      ownerId: user.id,
      scope: scope.data,
      content,
      actorUserId: user.id,
    })
    return redirectBack(request)
  } catch (error) {
    if (error instanceof AppError) {
      return redirectBack(request, `?error=${error.code.toLowerCase()}`)
    }
    throw error
  }
}

function redirectBack(request: Request, query = '') {
  const url = new URL('/app/memory', request.url)
  url.search = query
  return NextResponse.redirect(url, 303)
}
