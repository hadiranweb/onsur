import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  try {
    const view = await getApp().runs.get(user, context.params.id)
    return NextResponse.json(view)
  } catch (error) {
    // Anti-enumeration: never distinguish "missing" from "forbidden".
    if (error instanceof AppError && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    throw error
  }
}
