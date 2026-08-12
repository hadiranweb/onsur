import Link from 'next/link'
import type { ReactNode } from 'react'
import { getSessionUser } from '@/lib/server/auth'
import { redirect } from 'next/navigation'

/** Authenticated application shell: requires an active session. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="shell">
      <header className="shell__header">
        <span className="shell__brand">Element Plus</span>
        <nav className="shell__nav">
          <Link href="/app">Home</Link>
          <Link href="/app/founder">Founder</Link>
          <Link href="/app/islands">Islands</Link>
          <Link href="/app/runs">Runs</Link>
          <span className="shell__user">{user.displayName}</span>
          <form action="/api/auth/logout" method="post">
            <button type="submit">Log out</button>
          </form>
        </nav>
      </header>
      <div className="shell__body">{children}</div>
    </div>
  )
}
