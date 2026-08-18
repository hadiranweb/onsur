import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

async function personalWorkspaceId(userId: string): Promise<string | null> {
  const personal = await getApp().workspaces.getPersonalWorkspace(userId)
  return personal?.id ?? null
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const workspaceId = await personalWorkspaceId(user.id)
  if (!workspaceId) {
    return NextResponse.json({ error: 'no_workspace' }, { status: 409 })
  }

  const form = await request.formData()
  const correction = String(form.get('correction') ?? '').trim()
  if (!correction) {
    return redirectBack(request, context.params.id, '?error=empty')
  }

  try {
    await getApp().founder.correct(user, workspaceId, context.params.id, correction)
    return redirectBack(request, context.params.id)
  } catch (error) {
    if (error instanceof AppError) {
      return redirectBack(request, context.params.id, `?error=${error.code.toLowerCase()}`)
    }
    throw error
  }
}

function redirectBack(request: Request, id: string, query = '') {
  return NextResponse.redirect(new URL(`/app/founder/${id}${query}`, request.url), 303)
}
