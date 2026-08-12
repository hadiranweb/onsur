import { describe, expect, it } from 'vitest'
import { AuthService } from '../services/auth-service'
import { FounderService } from '../services/founder-service'
import { WorkspaceService } from '../services/workspace-service'
import { FakeStructuredLlm, MalformedStructuredLlm } from '../infrastructure/fake-structured-llm'
import {
  FakePasswordHasher,
  FakeSessionCodec,
  InMemoryMembershipRepository,
  InMemoryProblemRepository,
  InMemoryProblemSpecificationRepository,
  InMemorySessionRepository,
  InMemorySpsRepository,
  InMemoryUserRepository,
  InMemoryWorkspaceRepository,
} from './fakes'

async function build(llm = new FakeStructuredLlm()) {
  const users = new InMemoryUserRepository()
  const sessions = new InMemorySessionRepository()
  const workspacesRepo = new InMemoryWorkspaceRepository()
  const memberships = new InMemoryMembershipRepository()
  const workspaces = new WorkspaceService({ workspaces: workspacesRepo, memberships })

  const auth = new AuthService({
    users,
    sessions,
    hasher: new FakePasswordHasher(),
    codec: new FakeSessionCodec(),
    workspaces,
  })

  const specifications = new InMemoryProblemSpecificationRepository()
  const founder = new FounderService({
    problems: new InMemoryProblemRepository(),
    specifications,
    sps: new InMemorySpsRepository(),
    llm,
    workspaces,
  })

  const register = await auth.register({
    email: 'founder@example.com',
    password: 'password123',
    displayName: 'Founder User',
  })
  const personal = await workspaces.getPersonalWorkspace(register.user.id)
  return { auth, workspaces, founder, user: register.user, personal, specifications }
}

const RAW = 'My checkout flow fails at the payment step when a card is declined.'

describe('Founder: start', () => {
  it('creates a problem, runs the fake LLM, and leaves the session in review with a draft', async () => {
    const { founder, user, personal } = await build()
    const view = await founder.start(user, personal!.id, RAW)

    expect(view.session.status).toBe('review')
    expect(view.problem.rawProblem).toBe(RAW)
    expect(view.draft).not.toBeNull()
    expect(view.draft!.version).toBe('1.0.0')
    expect(view.draft!.status).toBe('draft')
  })

  it('preserves the raw problem verbatim', async () => {
    const { founder, user, personal } = await build()
    const view = await founder.start(user, personal!.id, RAW)
    expect(view.draft!.rawProblem).toBe(RAW)
    expect(view.problem.rawProblem).toBe(RAW)
  })

  it('separates evidence, assumption, and unknown', async () => {
    const { founder, user, personal } = await build()
    const view = await founder.start(user, personal!.id, RAW)
    const kinds = view.draft!.items.map((item) => item.kind)
    expect(kinds).toContain('evidence')
    expect(kinds).toContain('assumption')
    expect(kinds).toContain('unknown')
  })

  it('derives at least one success criterion', async () => {
    const { founder, user, personal } = await build()
    const view = await founder.start(user, personal!.id, RAW)
    expect(view.draft!.successCriteria.length).toBeGreaterThan(0)
  })

  it('rejects an empty raw problem', async () => {
    const { founder, user, personal } = await build()
    await expect(founder.start(user, personal!.id, '   ')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })

  it('rejects access for a non-member (cross-workspace)', async () => {
    const { founder, auth, workspaces } = await build()
    // A second user with their own personal workspace.
    const intruder = await auth.register({
      email: 'intruder@example.com',
      password: 'password123',
      displayName: 'Intruder',
    })
    const intruderPersonal = await workspaces.getPersonalWorkspace(intruder.user.id)
    const victim = await auth.register({
      email: 'victim@example.com',
      password: 'password123',
      displayName: 'Victim',
    })

    await expect(
      founder.start(intruder.user, intruderPersonal!.id, RAW).then(() =>
        // Use the victim's workspace id for a follow-up write by the intruder.
        founder.start(intruder.user, 'nonexistent-workspace', RAW),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    // Direct cross-workspace attempt: intruder against victim's workspace.
    const victimPersonal = await workspaces.getPersonalWorkspace(victim.user.id)
    await expect(founder.start(intruder.user, victimPersonal!.id, RAW)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})

describe('Founder: correct', () => {
  it('produces the next draft version and preserves the prior draft', async () => {
    const { founder, user, personal, specifications } = await build()
    const started = await founder.start(user, personal!.id, RAW)

    const corrected = await founder.correct(
      user,
      personal!.id,
      started.session.id,
      'The decline is a soft decline, not a hard failure.',
    )

    expect(corrected.session.status).toBe('review')
    expect(corrected.draft!.version).toBe('1.0.1')
    expect(corrected.draft!.status).toBe('draft')

    const all = specifications.all().filter((spec) => spec.problemId === started.problem.id)
    expect(all.map((spec) => spec.version).sort()).toEqual(['1.0.0', '1.0.1'])
    // Prior draft is preserved, not mutated.
    const first = all.find((spec) => spec.version === '1.0.0')!
    expect(first.status).toBe('draft')
  })

  it('records the correction in the message timeline', async () => {
    const { founder, user, personal } = await build()
    const started = await founder.start(user, personal!.id, RAW)
    await founder.correct(user, personal!.id, started.session.id, 'clarify the retry path')
    const view = await founder.get(user, personal!.id, started.session.id)
    const contents = view.messages.map((message) => message.content)
    expect(contents.some((content) => content.includes('clarify the retry path'))).toBe(true)
  })

  it('rejects a correction after confirmation (terminal)', async () => {
    const { founder, user, personal } = await build()
    const started = await founder.start(user, personal!.id, RAW)
    await founder.confirm(user, personal!.id, started.session.id)
    await expect(
      founder.correct(user, personal!.id, started.session.id, 'late correction'),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('Founder: confirm', () => {
  it('confirms the draft as a versioned ProblemSpecification', async () => {
    const { founder, user, personal } = await build()
    const started = await founder.start(user, personal!.id, RAW)
    const confirmed = await founder.confirm(user, personal!.id, started.session.id)

    expect(confirmed.session.status).toBe('confirmed')
    expect(confirmed.confirmed).not.toBeNull()
    expect(confirmed.confirmed!.version).toBe('1.0.0')
    expect(confirmed.confirmed!.status).toBe('confirmed')
    expect(confirmed.draft).toBeNull()
  })

  it('confirms the latest corrected version', async () => {
    const { founder, user, personal } = await build()
    const started = await founder.start(user, personal!.id, RAW)
    await founder.correct(user, personal!.id, started.session.id, 'rephrase the goal')
    const confirmed = await founder.confirm(user, personal!.id, started.session.id)
    expect(confirmed.confirmed!.version).toBe('1.0.1')
  })

  it('cannot confirm twice', async () => {
    const { founder, user, personal } = await build()
    const started = await founder.start(user, personal!.id, RAW)
    await founder.confirm(user, personal!.id, started.session.id)
    await expect(founder.confirm(user, personal!.id, started.session.id)).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })
})

describe('Founder: model output validation', () => {
  it('rejects malformed model output and does not persist a draft', async () => {
    const { founder, user, personal, specifications } = await build(new MalformedStructuredLlm())
    await expect(founder.start(user, personal!.id, RAW)).rejects.toMatchObject({
      code: 'MODEL_OUTPUT_INVALID',
    })
    expect(specifications.all()).toHaveLength(0)
  })
})
