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
  const runId = String(form.get('runId') ?? '').trim()
  const content = String(form.get('content') ?? '').trim()

  try {
    await getApp().feedback.submit({ runId, content, actorUserId: user.id })
    return NextResponse.redirect(new URL(`/app/runs/${runId}`, request.url), 303)
  } catch (error) {
    if (error instanceof AppError) {
      const url = new URL(`/app/runs/${runId}`, request.url)
      url.searchParams.set('error', error.code.toLowerCase())
      return NextResponse.redirect(url, 303)
    }
    throw error
  }
}
