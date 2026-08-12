import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@element-plus/application'
import { getApp } from '@/lib/server/services'
import { clearSessionCookieOptions } from '@/lib/server/session-cookie'

export async function POST(request: Request) {
  const cookieValue = cookies().get(SESSION_COOKIE_NAME)?.value
  await getApp().auth.logout(cookieValue)

  const response = NextResponse.redirect(new URL('/login', request.url), 303)
  response.cookies.set(clearSessionCookieOptions().name, '', clearSessionCookieOptions())
  return response
}
