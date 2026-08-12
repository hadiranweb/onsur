import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE_NAME } from '@element-plus/application'
import type { UserRecord } from '@element-plus/application'
import { getApp } from './services'

/** Resolve the request's session cookie to an active user, or null. */
export async function getSessionUser(): Promise<UserRecord | null> {
  const store = cookies()
  const value = store.get(SESSION_COOKIE_NAME)?.value
  return getApp().auth.getUserForCookie(value)
}

/** Require an active session for a server component or route handler. */
export async function requireUser(): Promise<UserRecord> {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }
  return user
}
