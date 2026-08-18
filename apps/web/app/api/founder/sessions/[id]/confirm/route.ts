import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export async function POST(request: Request, context: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const personal = await getApp().workspaces.getPersonalWorkspace(user.id)
  if (!personal) {
    return NextResponse.json({ error: 'no_workspace' }, { status: 409 })
  }

  try {
    await getApp().founder.confirm(user, personal.id, context.params.id)
    return NextResponse.redirect(new URL(`/app/founder/${context.params.id}`, request.url), 303)
  } catch (error) {
    if (error instanceof AppError) {
      const url = new URL(`/app/founder/${context.params.id}`, request.url)
      url.searchParams.set('error', error.code.toLowerCase())
      return NextResponse.redirect(url, 303)
    }
    throw error
  }
}
