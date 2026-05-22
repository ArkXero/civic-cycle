import { randomUUID } from 'node:crypto'
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { NextRequest } from 'next/server'
import {
  getLiveEmailConfig,
  waitForEmailBySubject,
} from '@/tests/helpers/email-inbox'

const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
}))

import { POST } from '@/app/api/cron/send-alerts/route'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChain(result: { data: unknown; error: unknown }): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = Promise.resolve(result)
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockReturnValue(chain)
  chain.in = vi.fn().mockReturnValue(chain)
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  return chain
}

function makeRequest(authHeader: string): NextRequest {
  return new NextRequest('http://localhost/api/cron/send-alerts', {
    method: 'POST',
    headers: {
      authorization: authHeader,
    },
  })
}

function requireLiveEmailConfig() {
  const missingRouteEnv = [
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'CRON_SECRET',
    'NEXT_PUBLIC_APP_URL',
  ].filter((key) => !process.env[key])

  if (missingRouteEnv.length > 0) {
    throw new Error(
      `Live email route configuration missing: ${missingRouteEnv.join(', ')}.`
    )
  }

  const inboxConfig = getLiveEmailConfig()

  if (!inboxConfig) {
    throw new Error(
      'Live email inbox configuration missing: set GMAIL_USER, GMAIL_APP_PASSWORD, and LIVE_EMAIL_TO or SMTP_USER.'
    )
  }

  return inboxConfig
}

function normalizeEmailSource(source: string): string {
  return source.replace(/=\r?\n/g, '').replace(/=3D/g, '=')
}

const describeLive =
  process.env.RUN_LIVE_EMAIL_TESTS === 'true' ? describe : describe.skip

const liveTimeoutMs = getLiveEmailConfig()?.timeoutMs || 60000

describeLive('POST /api/cron/send-alerts live email delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(
    'sends one real Resend alert email and verifies it in Gmail without Supabase writes',
    async () => {
      const inboxConfig = requireLiveEmailConfig()
      const uniqueToken = `live-${Date.now()}-${randomUUID()}`
      const syntheticUserId = '11111111-1111-4111-8111-111111111111'
      const syntheticMeetingId = '22222222-2222-4222-8222-222222222222'
      const syntheticAlertId = '33333333-3333-4333-8333-333333333333'
      const syntheticUnsubscribeToken = `unsubscribe-${uniqueToken}`
      const syntheticMeetingTitle = `Synthetic FCPS alert workflow ${uniqueToken}`
      const syntheticExcerpt = `Synthetic excerpt for ${uniqueToken}: mocked alert cron content reached real Resend delivery.`
      const appUrl = process.env.NEXT_PUBLIC_APP_URL!

      const meeting = {
        id: syntheticMeetingId,
        title: syntheticMeetingTitle,
        body: 'FCPS School Board',
        meeting_date: '2026-05-21',
      }
      const summary = {
        meeting_id: syntheticMeetingId,
        summary_text: syntheticExcerpt,
        topics: ['Live email workflow'],
        key_decisions: [],
        action_items: [],
      }
      const alert = {
        id: syntheticAlertId,
        user_id: syntheticUserId,
        keyword: uniqueToken,
        bodies: null,
        unsubscribe_token: syntheticUnsubscribeToken,
      }
      const userProfile = {
        id: syntheticUserId,
        email: inboxConfig.liveEmailTo,
      }

      mockAdminFrom.mockReturnValueOnce(makeChain({ data: [meeting], error: null }))
      mockAdminFrom.mockReturnValueOnce(makeChain({ data: [summary], error: null }))
      mockAdminFrom.mockReturnValueOnce(makeChain({ data: [alert], error: null }))
      mockAdminFrom.mockReturnValueOnce(makeChain({ data: [userProfile], error: null }))
      mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))
      const historyChain = makeChain({ data: null, error: null })
      mockAdminFrom.mockReturnValueOnce(historyChain)

      const expectedSubject = `Alert: "${uniqueToken}" mentioned in FCPS School Board meeting`
      const since = new Date(Date.now() - 1000)
      const response = await POST(makeRequest(`Bearer ${process.env.CRON_SECRET}`))
      const responseBody = await response.json()

      if (response.status !== 200) {
        throw new Error(
          `Route logic failed: expected HTTP 200, received ${response.status}: ${JSON.stringify(responseBody)}`
        )
      }

      if (responseBody.sent !== 1 || responseBody.processed !== 1) {
        throw new Error(
          `Resend delivery failed or was not counted by the route: ${JSON.stringify(responseBody)}`
        )
      }

      expect(responseBody).toEqual({
        message: 'Alert processing complete',
        sent: 1,
        processed: 1,
      })

      const receivedEmail = await waitForEmailBySubject({
        subject: expectedSubject,
        since,
        timeoutMs: inboxConfig.timeoutMs,
      })
      const source = normalizeEmailSource(receivedEmail.source)

      expect(
        receivedEmail.subject === expectedSubject || source.includes(expectedSubject)
      ).toBe(true)
      expect(source).toContain('Civic Cycle')
      expect(source).toContain(uniqueToken)
      expect(source).toContain(syntheticMeetingTitle)
      expect(source).toContain(syntheticExcerpt)
      expect(source).toContain(`${appUrl}/meetings/${syntheticMeetingId}`)
      expect(source).toContain(`${appUrl}/unsubscribe/${syntheticUnsubscribeToken}`)

      expect(historyChain.insert).toHaveBeenCalledOnce()
      expect(historyChain.insert.mock.calls[0][0]).toMatchObject({
        email_status: 'sent',
        user_id: syntheticUserId,
        meeting_id: syntheticMeetingId,
        alert_preference_id: syntheticAlertId,
        matched_keyword: uniqueToken,
      })
    },
    liveTimeoutMs + 30000
  )
})
