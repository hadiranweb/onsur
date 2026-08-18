import { NextResponse } from 'next/server'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const islands = await getApp().islands.list()
  return NextResponse.json({ islands })
}

/**
 * Create a draft Island from a minimal form: name + description, bound to the
 * structured-analysis capability with the fake runtime.
 */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const form = await request.formData()
  const name = String(form.get('name') ?? '').trim()
  const description = String(form.get('description') ?? '').trim()

  try {
    const island = await getApp().islands.createDraft({
      manifest: {
        name,
        description,
        capabilities: [{ id: 'cap-structured-analysis', kind: 'capability' }],
        runtime: { runtime: 'fake', config: {} },
        permissions: [],
      },
      actorUserId: user.id,
    })
    return NextResponse.redirect(new URL(`/app/islands/${island.id}`, request.url), 303)
  } catch (error) {
    if (error instanceof AppError) {
      const url = new URL('/app/islands', request.url)
      url.searchParams.set('error', error.code.toLowerCase())
      return NextResponse.redirect(url, 303)
    }
    throw error
  }
}
