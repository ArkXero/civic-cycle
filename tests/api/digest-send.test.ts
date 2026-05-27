import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NextRequest } from 'next/server'

const mockAdminFrom = vi.fn()
const mockCreateAdminClient = vi.fn(() => ({ from: mockAdminFrom }))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))

const mockSendDigestEmail = vi.fn()

vi.mock('@/lib/resend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/resend')>()
  return {
    ...actual,
    sendDigestEmail: (...args: unknown[]) => mockSendDigestEmail(...args),
  }
})

import { POST } from '@/app/api/digest/send/route'

const CRON_SECRET = 'test-cron-secret-abc'
const SUPABASE_URL = 'https://test-project.supabase.co'
const SERVICE_ROLE_KEY = 'test-service-role-key'

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) {
    headers.authorization = authHeader
  }
  return new NextRequest('http://localhost/api/digest/send', {
    method: 'POST',
    headers,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChain(result: { data: unknown; error: unknown }): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = Promise.resolve(result)
  chain.select = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockResolvedValue(result)
  chain.in = vi.fn().mockResolvedValue(result)
  return chain
}

const fakeMeeting = {
  id: 'meeting-1',
  title: 'March 2026 Board Meeting',
  body: 'FCPS School Board',
  district_id: 'fairfax',
  meeting_date: '2026-03-04',
}

const fakeSummary = {
  meeting_id: 'meeting-1',
  summary_text: 'The board discussed the FY2027 budget proposal in detail.',
}

const fakeSubscriber = {
  id: 'subscriber-1',
  email: 'voter@example.com',
  unsubscribe_token: 'unsubscribe-token-1',
  district_id: 'fairfax',
}

describe('POST /api/digest/send', () => {
  beforeEach(() => {
    mockAdminFrom.mockReset()
    mockCreateAdminClient.mockReset()
    mockSendDigestEmail.mockReset()
    process.env.CRON_SECRET = CRON_SECRET
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY
    process.env.NEXT_PUBLIC_APP_URL = 'https://civiccycle.net'
    mockCreateAdminClient.mockImplementation(() => ({ from: mockAdminFrom }))
    mockSendDigestEmail.mockResolvedValue({ data: { id: 'email-ok' }, error: null })
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('returns 401 when Authorization header is missing', async () => {
    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
  })

  it('returns 401 when Authorization header has wrong token', async () => {
    const res = await POST(makeRequest('Bearer wrong-secret'))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
  })

  it('returns 401 when CRON_SECRET env var is not set', async () => {
    delete process.env.CRON_SECRET

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    })
  })

  it('returns 500 CONFIG_ERROR when required Supabase env is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: 'Digest misconfigured',
      code: 'CONFIG_ERROR',
    })
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('returns 500 CONFIG_ERROR when createAdminClient throws unexpectedly', async () => {
    mockCreateAdminClient.mockImplementationOnce(() => {
      throw new Error('supabaseUrl is required.')
    })

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: 'Digest misconfigured',
      code: 'CONFIG_ERROR',
    })
  })

  it('returns 500 MEETINGS_QUERY_FAILED when meetings query fails', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSubscriber], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('db error') }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: 'Failed to fetch meetings',
      code: 'MEETINGS_QUERY_FAILED',
    })
  })

  it('returns 200 when no eligible meetings exist', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSubscriber], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [], error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      message: 'No meetings to digest',
      sent: 0,
    })
  })

  it('returns 500 SUMMARIES_QUERY_FAILED when summaries query fails', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSubscriber], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('summary err') }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: 'Failed to fetch summaries',
      code: 'SUMMARIES_QUERY_FAILED',
    })
  })

  it('returns 200 when meetings exist but none have summaries', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSubscriber], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [], error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      message: 'No meetings to digest',
      sent: 0,
    })
  })

  it('returns 500 SUBSCRIBERS_QUERY_FAILED when subscribers query fails', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('subscriber err') }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      error: 'Failed to fetch subscribers',
      code: 'SUBSCRIBERS_QUERY_FAILED',
    })
  })

  it('returns 200 when no active subscribers exist', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [], error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      message: 'No active subscribers',
      sent: 0,
    })
  })

  it('returns 200 with correct sent count when sends succeed', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSubscriber], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    expect(mockSendDigestEmail).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body).toEqual({
      message: 'Digest sent',
      sent: 1,
      meetings: 1,
      districts: {
        fairfax: {
          sent: 1,
          meetings: 1,
        },
      },
    })
  })

  it('returns 200 with partial success when one subscriber send fails', async () => {
    const secondSubscriber = {
      id: 'subscriber-2',
      email: 'voter2@example.com',
      unsubscribe_token: 'unsubscribe-token-2',
      district_id: 'fairfax',
    }
    mockSendDigestEmail
      .mockRejectedValueOnce(new Error('send failed'))
      .mockResolvedValueOnce({ data: { id: 'email-ok-2' }, error: null })

    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: [fakeSubscriber, secondSubscriber], error: null })
    )
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    expect(mockSendDigestEmail).toHaveBeenCalledTimes(2)
    const body = await res.json()
    expect(body.sent).toBe(1)
    expect(body.meetings).toBe(1)
  })

  it('returns 200 even when marking meetings as sent fails', async () => {
    const updateChain = makeChain({ data: null, error: new Error('update failed') })

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSubscriber], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(updateChain)

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    expect(updateChain.update).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body.sent).toBe(1)
  })

  it('passes the expected params to sendDigestEmail', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSubscriber], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendDigestEmail).toHaveBeenCalledOnce()
    const call = mockSendDigestEmail.mock.calls[0][0]
    expect(call.to).toBe(fakeSubscriber.email)
    expect(call.unsubscribeUrl).toBe(
      `https://civiccycle.net/unsubscribe/digest/${fakeSubscriber.unsubscribe_token}`
    )
    expect(call.digestHtml).toContain(fakeMeeting.title)
    expect(call.digestText).toContain(fakeMeeting.id)
    expect(call.weekRange).toBe('March 4, 2026')
    expect(call.districtLabel).toBe('FCPS School Board')
  })
})
