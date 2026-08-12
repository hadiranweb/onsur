import Link from 'next/link'

export default function Home() {
  return (
    <main className="home">
      <h1>Element Plus</h1>
      <p className="home__fa" lang="fa" dir="rtl">
        عنصر پلاس
      </p>
      <p>A structured problem-solving platform.</p>
      <p className="home__actions">
        <Link href="/login">Log in</Link>
        <Link href="/register">Register</Link>
      </p>
      <p>
        Health surface: <a href="/api/health">/api/health</a>
      </p>
    </main>
  )
}
