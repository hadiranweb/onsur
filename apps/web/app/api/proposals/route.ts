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
  const targetId = String(form.get('targetId') ?? '').trim()
  const targetKind = String(form.get('targetKind') ?? '').trim()
  const fromVersion = String(form.get('fromVersion') ?? '').trim()
  const toVersion = String(form.get('toVersion') ?? '').trim()
  const rationale = String(form.get('rationale') ?? '').trim()
  const content = String(form.get('content') ?? '').trim()

  try {
    await getApp().proposals.propose({
      target: { id: targetId, kind: targetKind as 'knowledge' },
      fromVersion,
      toVersion,
      rationale,
      content: content || undefined,
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
