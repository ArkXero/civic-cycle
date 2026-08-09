import { describe, expect, it, vi } from 'vite-plus/test'
const { mockAnthropicCreate } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn(),
}))
vi.mock('@/lib/anthropic', () => ({
  anthropic: { messages: { create: mockAnthropicCreate } },
}))

import { getMeetingIdsForTopicSlugs, normalizeTopicSlugs } from '@/lib/data/topics'
import {
  assignmentReviewStatus,
  classifyMarkdownAgainstTopics,
  rollupTopicAssignments,
  validateTopicAssignments,
} from '@/lib/topic-classification'
import { makeChain } from '@/tests/helpers/supabase-chain'

describe('topic filtering and confidence gates', () => {
  it('normalizes repeated topic params and rejects invalid slugs', () => {
    expect(normalizeTopicSlugs(['Budget', 'budget', '../unsafe', 'school-safety'])).toEqual([
      'budget',
      'school-safety',
    ])
  })

  it('uses OR semantics by returning union of meetings for selected slugs', async () => {
    const chain = makeChain({
      data: [{ meeting_id: 'm1' }, { meeting_id: 'm1' }, { meeting_id: 'm2' }],
      error: null,
    })
    const supabase = { from: vi.fn().mockReturnValue(chain) }
    const ids = await getMeetingIdsForTopicSlugs(supabase as never, ['budget', 'safety'])
    expect(ids).toEqual(['m1', 'm2'])
    expect(chain.in).toHaveBeenCalledWith('topic.slug', ['budget', 'safety'])
  })

  it('auto-publishes only after calibration reaches 90 percent precision', () => {
    expect(assignmentReviewStatus(0.99, 0.89, 0.95)).toBe('pending')
    expect(assignmentReviewStatus(0.94, 0.95, 0.95)).toBe('pending')
    expect(assignmentReviewStatus(0.96, 0.95, 0.95)).toBe('approved')
  })

  it('drops unknown topics and untraceable evidence', () => {
    const valid = {
      topic_id: '11111111-1111-4111-8111-111111111111',
      confidence: 0.98,
      rationale: 'Budget vote',
      evidence: [{ quote: 'approved the budget', source: '7.03', page: 2 }],
    }
    const invalid = { ...valid, evidence: [{ ...valid.evidence[0], quote: 'invented quote' }] }
    expect(validateTopicAssignments(
      '<!-- page:2 --> approved the budget',
      new Set([valid.topic_id]),
      [valid, invalid]
    )).toEqual([valid])
  })

  it('rejects evidence with wrong source or page provenance', () => {
    const topicId = '11111111-1111-4111-8111-111111111111'
    const base = {
      topic_id: topicId,
      confidence: 0.98,
      rationale: 'Budget vote',
      evidence: [{ quote: 'approved the budget', source: '7.03 / Budget.pdf', page: 2 }],
    }
    expect(validateTopicAssignments(
      '<!-- page:2 --> approved the budget',
      new Set([topicId]),
      [base, { ...base, evidence: [{ ...base.evidence[0], page: 1 }] }],
      '7.03 / Budget.pdf'
    )).toEqual([base])
    expect(validateTopicAssignments(
      '<!-- page:2 --> approved the budget',
      new Set([topicId]),
      [{ ...base, evidence: [{ ...base.evidence[0], source: 'Other.pdf' }] }],
      '7.03 / Budget.pdf'
    )).toEqual([])
  })

  it('rolls chunk assignments up using max confidence and unique evidence', () => {
    const topicId = '11111111-1111-4111-8111-111111111111'
    const result = rollupTopicAssignments([
      {
        topic_id: topicId,
        confidence: 0.7,
        rationale: 'First chunk',
        evidence: [{ quote: 'budget', source: 'item', page: 1 }],
      },
      {
        topic_id: topicId,
        confidence: 0.9,
        rationale: 'Second chunk',
        evidence: [{ quote: 'vote', source: 'item', page: 2 }],
      },
    ])
    expect(result).toEqual([{
      topic_id: topicId,
      confidence: 0.9,
      rationale: 'Second chunk',
      evidence: [
        { quote: 'budget', source: 'item', page: 1 },
        { quote: 'vote', source: 'item', page: 2 },
      ],
    }])
  })

  it('limits concurrent classifier requests for oversized documents', async () => {
    let activeRequests = 0
    let maxActiveRequests = 0
    mockAnthropicCreate.mockImplementation(async () => {
      activeRequests++
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
      await new Promise((resolve) => setTimeout(resolve, 2))
      activeRequests--
      return {
        content: [{ type: 'text', text: '{"assignments":[],"suggestions":[]}' }],
      } as never
    })

    const markdown = Array.from(
      { length: 6 },
      (_, index) => `## Section ${index}\n${`word-${index} `.repeat(1_800)}`
    ).join('\n\n')
    await classifyMarkdownAgainstTopics({
      markdown,
      sourceLabel: 'Oversized attachment',
      topics: [],
      model: 'test-model',
    })

    expect(mockAnthropicCreate.mock.calls.length).toBeGreaterThan(2)
    expect(maxActiveRequests).toBe(2)
  })
})
