import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/auth/is-admin-server', () => ({
  isAdminUser: vi.fn(),
}))
vi.mock('@/lib/data/topics', () => ({
  getApprovedTopicHierarchy: vi.fn(),
}))

import { GET as getPublicTopics } from '@/app/api/topics/route'
import {
  GET as getAdminReviewQueue,
  PATCH as updateSuggestion,
} from '@/app/api/admin/topics/suggestions/route'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getApprovedTopicHierarchy } from '@/lib/data/topics'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { makeChain } from '@/tests/helpers/supabase-chain'

const mockedCreateClient = vi.mocked(createClient)
const mockedCreateAdminClient = vi.mocked(createAdminClient)
const mockedHierarchy = vi.mocked(getApprovedTopicHierarchy)
const mockedIsAdminUser = vi.mocked(isAdminUser)

describe('topic API visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns approved public hierarchy and meeting counts', async () => {
    const client = { from: vi.fn() }
    mockedCreateClient.mockResolvedValue(client as never)
    mockedHierarchy.mockResolvedValue([{
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'budget',
      display_name: 'Budget',
      description: '',
      parent_id: null,
      synonyms: [],
      active: true,
      taxonomy_version: 1,
      created_at: '2026-08-09T00:00:00.000Z',
      updated_at: '2026-08-09T00:00:00.000Z',
      meetingCount: 3,
      children: [],
    }])

    const response = await getPublicTopics()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [{ slug: 'budget', meetingCount: 3 }],
    })
    expect(mockedHierarchy).toHaveBeenCalledWith(client)
  })

  it('keeps suggestion and evidence queue unavailable to anonymous users', async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)

    const response = await getAdminReviewQueue()
    expect(response.status).toBe(403)
    expect(mockedCreateAdminClient).not.toHaveBeenCalled()
  })

  it('rejects suggestion approval when its slug already belongs to a topic', async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin' } } }) },
    } as never)
    mockedIsAdminUser.mockResolvedValue(true)
    const existingTopic = makeChain({
      data: { id: '11111111-1111-4111-8111-111111111111' },
      error: null,
    })
    const admin = { from: vi.fn().mockReturnValue(existingTopic) }
    mockedCreateAdminClient.mockReturnValue(admin as never)

    const response = await updateSuggestion(new Request('http://localhost/api/admin/topics/suggestions', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        id: '22222222-2222-4222-8222-222222222222',
        slug: 'budget',
        displayName: 'Budget rewrite',
        description: '',
        parentId: null,
      }),
    }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Topic slug already exists; merge the suggestion instead',
    })
    expect(existingTopic.insert).not.toHaveBeenCalled()
  })
})
