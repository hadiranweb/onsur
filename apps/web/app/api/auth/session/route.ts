import { NextResponse } from 'next/server'
import { publicUserSchema } from '@element-plus/contracts'
import { getSessionUser } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  const publicUser = publicUserSchema.parse(user)
  return NextResponse.json({ user: publicUser })
}
