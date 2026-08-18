import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const form = await request.formData()
  const rawProblem = String(form.get('rawProblem') ?? '').trim()
  if (!rawProblem) {
    return redirectBack(request, '?error=empty')
  }

  try {
    const personal = await getApp().workspaces.getPersonalWorkspace(user.id)
    if (!personal) {
      return NextResponse.json({ error: 'no_workspace' }, { status: 409 })
    }
    const view = await getApp().founder.start(user, personal.id, rawProblem)
    const url = new URL(`/app/founder/${view.session.id}`, request.url)
    return NextResponse.redirect(url, 303)
  } catch (error) {
    if (error instanceof AppError) {
      return redirectBack(request, `?error=${error.code.toLowerCase()}`)
    }
    throw error
  }
}

function redirectBack(request: Request, query: string) {
  const url = new URL('/app/founder', request.url)
  url.search = query
  return NextResponse.redirect(url, 303)
}
