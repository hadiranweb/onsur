import { NextResponse } from 'next/server'
import { loginInputSchema } from '@element-plus/contracts'
import { AppError } from '@element-plus/application'
import { getApp } from '@/lib/server/services'
import { sessionCookieOptions } from '@/lib/server/session-cookie'

export async function POST(request: Request) {
  const form = await request.formData()
  const parsed = loginInputSchema.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  })
  if (!parsed.success) {
    return redirectWithError('/login', 'invalid_input')
  }

  try {
    const { cookieValue } = await getApp().auth.login(parsed.data)
    const response = NextResponse.redirect(new URL('/app', request.url), 303)
    response.cookies.set(sessionCookieOptions().name, cookieValue, sessionCookieOptions())
    return response
  } catch (error) {
    if (error instanceof AppError) {
      return redirectWithError('/login', error.code.toLowerCase())
    }
    throw error
  }
}

function redirectWithError(path: string, code: string) {
  const url = new URL(path, 'http://localhost')
  url.searchParams.set('error', code)
  return NextResponse.redirect(url, 303)
}
