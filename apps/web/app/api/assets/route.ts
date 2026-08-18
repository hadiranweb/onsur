import { NextResponse } from 'next/server'
import { assetKindSchema } from '@element-plus/contracts'
import { AppError } from '@element-plus/application'
import { getSessionUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const publicAssets = await getApp().assets.listPublic()
  return NextResponse.json({ assets: publicAssets })
}

/** Register a new asset (private by default). */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const form = await request.formData()
  const kind = assetKindSchema.safeParse(form.get('kind'))
  const name = String(form.get('name') ?? '').trim()
  const description = String(form.get('description') ?? '').trim()
  const license = String(form.get('license') ?? '').trim()
  const contentRefId = String(form.get('contentRefId') ?? '').trim()
  const contentRefKind = String(form.get('contentRefKind') ?? '').trim()

  if (!kind.success || !name || !description || !license || !contentRefId) {
    return redirectBack(request, '?error=invalid_input')
  }

  try {
    const asset = await getApp().assets.register({
      kind: kind.data,
      name,
      description,
      license,
      contentRef: { id: contentRefId, kind: contentRefKind as 'island' },
      actorUserId: user.id,
    })
    return NextResponse.redirect(new URL(`/app/assets/${asset.id}`, request.url), 303)
  } catch (error) {
    if (error instanceof AppError) {
      return redirectBack(request, `?error=${error.code.toLowerCase()}`)
    }
    throw error
  }
}

function redirectBack(request: Request, query: string) {
  const url = new URL('/app/assets', request.url)
  url.search = query
  return NextResponse.redirect(url, 303)
}
