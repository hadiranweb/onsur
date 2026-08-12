import Link from 'next/link'

export default function RegisterPage({ searchParams }: { searchParams: { error?: string } }) {
  const error = searchParams.error
  return (
    <main className="auth">
      <h1>Register</h1>
      {error && (
        <p role="alert" className="auth__error">
          {error === 'email_taken'
            ? 'An account with this email already exists.'
            : `Registration failed (${error}).`}
        </p>
      )}
      <form action="/api/auth/register" method="post" className="auth__form">
        <label>
          Display name
          <input name="displayName" required autoComplete="name" />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password (min 8 characters)
          <input
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </label>
        <button type="submit">Create account</button>
      </form>
      <p>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  )
}
