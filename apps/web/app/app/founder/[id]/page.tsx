import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppError } from '@element-plus/application'
import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function FounderSession({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string }
}) {
  const user = await requireUser()
  const personal = await getApp().workspaces.getPersonalWorkspace(user.id)
  if (!personal) {
    notFound()
  }

  let view
  try {
    view = await getApp().founder.get(user, personal.id, params.id)
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') {
      notFound()
    }
    throw error
  }

  const { session, problem, draft, confirmed, messages } = view

  return (
    <main>
      <p>
        <Link href="/app/founder">← Back to Founder</Link>
      </p>
      <h1>SPS session</h1>
      <p>
        Status: <strong>{session.status}</strong>
      </p>

      {searchParams.error && (
        <p role="alert" className="founder__error">
          Founder error ({searchParams.error}).
        </p>
      )}

      <section className="founder__raw">
        <h2>Raw problem (preserved)</h2>
        <p>{problem.rawProblem}</p>
      </section>

      {confirmed && (
        <section className="founder__confirmed">
          <h2>Confirmed ProblemSpecification — v{confirmed.version}</h2>
          <p>
            Specification id: <code>{confirmed.id}</code> (use this to start a Run)
          </p>
          <StructuredView draft={confirmed} />
        </section>
      )}

      {draft && !confirmed && session.status === 'review' && (
        <>
          <section className="founder__draft">
            <h2>Structured understanding (draft v{draft.version})</h2>
            <StructuredView draft={draft} />
          </section>

          <section className="founder__actions">
            <form action={`/api/founder/sessions/${session.id}/confirm`} method="post">
              <button type="submit">Confirm this understanding</button>
            </form>
            <form
              action={`/api/founder/sessions/${session.id}/correct`}
              method="post"
              className="founder__form"
            >
              <label>
                Request a correction
                <textarea
                  name="correction"
                  rows={3}
                  required
                  placeholder="What should be corrected or clarified?"
                />
              </label>
              <button type="submit">Apply correction</button>
            </form>
          </section>
        </>
      )}

      {!draft && !confirmed && <p>This session has no structured understanding yet.</p>}

      <section className="founder__messages">
        <h2>Timeline</h2>
        <ol>
          {messages.map((message) => (
            <li key={message.id}>
              <strong>{message.role}</strong>: {message.content}
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

function StructuredView({
  draft,
}: {
  draft: {
    structuredUnderstanding: string
    items: { kind: string; text: string }[]
    successCriteria: string[]
    constraints: string[]
  }
}) {
  return (
    <div>
      <p>{draft.structuredUnderstanding}</p>
      <h3>Evidence / Assumptions / Unknowns</h3>
      <ul>
        {draft.items.map((item, index) => (
          <li key={index}>
            <em>{item.kind}</em>: {item.text}
          </li>
        ))}
      </ul>
      <h3>Success criteria</h3>
      <ul>
        {draft.successCriteria.map((criterion, index) => (
          <li key={index}>{criterion}</li>
        ))}
      </ul>
      {draft.constraints.length > 0 && (
        <>
          <h3>Constraints</h3>
          <ul>
            {draft.constraints.map((constraint, index) => (
              <li key={index}>{constraint}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
