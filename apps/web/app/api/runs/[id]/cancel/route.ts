import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export async function POST(request: Request, context: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  try {
    await getApp().runs.cancel(user, context.params.id)
    return NextResponse.redirect(new URL(`/app/runs/${context.params.id}`, request.url), 303)
  } catch (error) {
    if (error instanceof AppError) {
      const url = new URL(`/app/runs/${context.params.id}`, request.url)
      url.searchParams.set('error', error.code.toLowerCase())
      return NextResponse.redirect(url, 303)
    }
    throw error
  }
}
