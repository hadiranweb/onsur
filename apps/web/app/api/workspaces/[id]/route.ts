import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

/**
 * Workspace detail. Server-side authorization: only members may read the
 * workspace; everyone else gets a uniform 404 so existence is not leaked.
 */
export async function GET(_request: Request, context: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const access = await getApp().workspaces.assertAccess(user.id, context.params.id)
    return NextResponse.json({ workspace: access.workspace, role: access.role })
  } catch (error) {
    if (error instanceof AppError && error.code === 'FORBIDDEN') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    throw error
  }
}
