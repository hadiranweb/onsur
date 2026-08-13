import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export async function POST(request: Request, context: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const form = await request.formData()
  const action = String(form.get('action') ?? '')
  const service = getApp().memory

  try {
    if (action === 'promote') await service.promote(context.params.id, user.id)
    else if (action === 'reject') await service.reject(context.params.id, user.id)
    return NextResponse.redirect(new URL('/app/memory', request.url), 303)
  } catch (error) {
    if (error instanceof AppError) {
      const url = new URL('/app/memory', request.url)
      url.searchParams.set('error', error.code.toLowerCase())
      return NextResponse.redirect(url, 303)
    }
    throw error
  }
}
