import Link from 'next/link'

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const error = searchParams.error
  return (
    <main className="auth">
      <h1>Log in</h1>
      {error && (
        <p role="alert" className="auth__error">
          {error === 'invalid_credentials'
            ? 'Invalid email or password.'
            : `Login failed (${error}).`}
        </p>
      )}
      <form action="/api/auth/login" method="post" className="auth__form">
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button type="submit">Log in</button>
      </form>
      <p>
        No account? <Link href="/register">Register</Link>
      </p>
    </main>
  )
}
