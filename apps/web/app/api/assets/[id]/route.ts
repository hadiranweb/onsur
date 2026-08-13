import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

/** Publish, install, or fork an asset. */
export async function POST(request: Request, context: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const form = await request.formData()
  const action = String(form.get('action') ?? '')
  const services = getApp()

  try {
    if (action === 'publish') {
      await services.assets.publish(context.params.id, user.id)
      return NextResponse.redirect(new URL(`/app/assets/${context.params.id}`, request.url), 303)
    }
    if (action === 'fork') {
      const fork = await services.assets.fork(context.params.id, user.id)
      return NextResponse.redirect(new URL(`/app/assets/${fork.asset.id}`, request.url), 303)
    }
    if (action === 'install') {
      const personal = await services.workspaces.getPersonalWorkspace(user.id)
      if (!personal) {
        return NextResponse.json({ error: 'no_workspace' }, { status: 409 })
      }
      await services.assets.installLatest(context.params.id, personal.id, user.id)
      return NextResponse.redirect(new URL('/app/assets', request.url), 303)
    }
    return NextResponse.redirect(new URL(`/app/assets/${context.params.id}`, request.url), 303)
  } catch (error) {
    if (error instanceof AppError) {
      const url = new URL(`/app/assets/${context.params.id}`, request.url)
      url.searchParams.set('error', error.code.toLowerCase())
      return NextResponse.redirect(url, 303)
    }
    throw error
  }
}
