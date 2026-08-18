import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

/** Ensure the reference Controlled Action Island exists (reuse or create). */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const result = await getApp().islands.ensureControlledActionIsland({ actorUserId: user.id })
    const url = new URL(`/app/islands/${result.island.id}`, request.url)
    url.searchParams.set('reused', String(result.reused))
    return NextResponse.redirect(url, 303)
  } catch (error) {
    if (error instanceof AppError) {
      const url = new URL('/app/islands', request.url)
      url.searchParams.set('error', error.code.toLowerCase())
      return NextResponse.redirect(url, 303)
    }
    throw error
  }
}
