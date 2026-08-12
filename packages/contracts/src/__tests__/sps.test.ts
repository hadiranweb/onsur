import { describe, expect, it } from 'vitest'
import {
  spsEventSchema,
  spsMessageSchema,
  spsSessionSchema,
  spsStatusSchema,
  structuredProblemOutputSchema,
} from '../sps'

const NOW = '2026-08-13T00:00:00.000Z'

describe('SPS contracts', () => {
  it('accepts a valid status and event', () => {
    expect(spsStatusSchema.parse('review')).toBe('review')
    expect(spsEventSchema.parse('correct')).toBe('correct')
    expect(spsStatusSchema.safeParse('confirmed2').success).toBe(false)
    expect(spsEventSchema.safeParse('explode').success).toBe(false)
  })

  it('parses a message with an ordered seq', () => {
    const message = spsMessageSchema.parse({
      id: 'm-1',
      sessionId: 's-1',
      role: 'user',
      content: 'my problem',
      seq: 0,
      createdAt: NOW,
    })
    expect(message.role).toBe('user')
    expect(spsMessageSchema.safeParse({ ...message, seq: -1 }).success).toBe(false)
  })

  it('parses a session with a message list', () => {
    const session = spsSessionSchema.parse({
      id: 's-1',
      workspaceId: 'ws-1',
      problemId: 'p-1',
      status: 'open',
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(session.messages).toEqual([])
    expect(session.status).toBe('open')
  })

  describe('structured problem output (model output gate)', () => {
    const valid = {
      structuredUnderstanding: 'the problem is X',
      items: [
        { kind: 'evidence', text: 'log shows an error' },
        { kind: 'assumption', text: 'smtp is reachable' },
        { kind: 'unknown', text: 'root cause' },
      ],
      successCriteria: ['user can reset password'],
    }

    it('accepts a valid structured output', () => {
      const parsed = structuredProblemOutputSchema.parse(valid)
      expect(parsed.constraints).toEqual([])
      expect(parsed.items).toHaveLength(3)
    })

    it('rejects output missing success criteria', () => {
      const { successCriteria: _successCriteria, ...rest } = valid
      expect(structuredProblemOutputSchema.safeParse(rest).success).toBe(false)
    })

    it('rejects output with empty success criteria', () => {
      expect(
        structuredProblemOutputSchema.safeParse({ ...valid, successCriteria: [] }).success,
      ).toBe(false)
    })

    it('rejects output with an invalid item kind', () => {
      expect(
        structuredProblemOutputSchema.safeParse({
          ...valid,
          items: [{ kind: 'opinion', text: 'x' }],
        }).success,
      ).toBe(false)
    })
  })
})
