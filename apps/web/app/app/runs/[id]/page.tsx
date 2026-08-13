import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppError } from '@element-plus/application'
import { requireUser } from '@/lib/server/auth'
import { getApp } from '@/lib/server/services'

export const dynamic = 'force-dynamic'

export default async function RunDetail({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { error?: string }
}) {
  await requireUser()

  let view
  try {
    view = await getApp().runs.get(params.id)
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') {
      notFound()
    }
    throw error
  }

  const { run, events, approvals, toolCalls, effects, artifacts, evaluations } = view
  const pending = approvals.filter((approval) => approval.status === 'pending')
  const feedback = await getApp().feedback.listByRun(run.id)

  return (
    <main>
      <p>
        <Link href="/app/runs">← Back to Runs</Link>
      </p>
      <h1>Run {run.id.slice(0, 8)}</h1>
      <p>
        Status: <strong>{run.status}</strong>
      </p>

      {searchParams.error && (
        <p role="alert" className="founder__error">
          Run error ({searchParams.error}).
        </p>
      )}

      {pending.length > 0 && (
        <section className="run__approvals">
          <h2>Pending approvals</h2>
          {pending.map((approval) => (
            <div key={approval.id} className="run__approval">
              <p>
                <em>{approval.effectKind}</em> effect requires approval.
              </p>
              <form
                action={`/api/runs/${run.id}/approvals/${approval.id}`}
                method="post"
                className="founder__actions"
              >
                <button type="submit" name="decision" value="approve">
                  Approve
                </button>
                <button type="submit" name="decision" value="reject">
                  Reject
                </button>
              </form>
            </div>
          ))}
        </section>
      )}

      {['queued', 'running', 'awaiting_approval'].includes(run.status) && (
        <form action={`/api/runs/${run.id}/cancel`} method="post">
          <button type="submit">Cancel run</button>
        </form>
      )}

      <section className="run__timeline">
        <h2>Timeline</h2>
        <ol>
          {events.map((event) => (
            <li key={event.id}>
              #{event.seq} <strong>{event.type}</strong>{' '}
              {Object.keys(event.payload).length > 0 ? `— ${JSON.stringify(event.payload)}` : ''}
            </li>
          ))}
        </ol>
      </section>

      <section className="run__toolcalls">
        <h2>Tool calls</h2>
        {toolCalls.length === 0 ? (
          <p>No tool calls.</p>
        ) : (
          <ul>
            {toolCalls.map((toolCall) => (
              <li key={toolCall.id}>
                {toolCall.toolName} — <em>{toolCall.effectKind}</em> — {toolCall.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="run__effects">
        <h2>Effects</h2>
        {effects.length === 0 ? (
          <p>No external effects recorded.</p>
        ) : (
          <ul>
            {effects.map((effect) => (
              <li key={effect.id}>
                {effect.kind}: {effect.description}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="run__artifacts">
        <h2>Artifacts</h2>
        {artifacts.length === 0 ? (
          <p>No artifacts.</p>
        ) : (
          <ul>
            {artifacts.map((artifact) => (
              <li key={artifact.id}>
                {artifact.kind} ({artifact.mimeType}): {JSON.stringify(artifact.data)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="run__evaluations">
        <h2>Evaluations</h2>
        {evaluations.length === 0 ? (
          <p>No evaluations.</p>
        ) : (
          <ul>
            {evaluations.map((evaluation) => (
              <li key={evaluation.id}>
                {evaluation.verdict}
                {evaluation.score !== undefined ? ` — score ${evaluation.score}` : ''}
              </li>
            ))}
          </ul>
        )}
        {run.status === 'completed' && (
          <form action={`/api/runs/${run.id}/evaluate`} method="post" className="founder__actions">
            <button type="submit" name="verdict" value="pass">
              Pass
            </button>
            <button type="submit" name="verdict" value="fail">
              Fail
            </button>
            <button type="submit" name="verdict" value="needs_review">
              Needs review
            </button>
          </form>
        )}
      </section>

      <section className="run__feedback">
        <h2>Feedback</h2>
        {feedback.length === 0 ? (
          <p>No feedback yet.</p>
        ) : (
          <ul>
            {feedback.map((entry) => (
              <li key={entry.id}>
                [{entry.status}] {entry.content}
              </li>
            ))}
          </ul>
        )}
        {run.status === 'completed' && (
          <form action="/api/feedback" method="post" className="founder__form">
            <input type="hidden" name="runId" value={run.id} />
            <label>
              Add feedback
              <textarea name="content" rows={3} required />
            </label>
            <button type="submit">Submit feedback</button>
          </form>
        )}
      </section>
    </main>
  )
}
