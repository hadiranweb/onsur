import { NextResponse } from 'next/server'
import { createWorkspaceInputSchema } from '@element-plus/contracts'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const accesses = await getApp().workspaces.listForUser(user.id)
  return NextResponse.json({ workspaces: accesses })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = createWorkspaceInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const workspace = await getApp().workspaces.createTeamWorkspace(user, parsed.data)
    return NextResponse.json({ workspace }, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.code.toLowerCase() }, { status: error.status })
    }
    throw error
  }
}
