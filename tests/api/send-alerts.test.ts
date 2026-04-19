import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ───────────────────────────────────────────────────────────────────
// Must be declared before any imports that depend on them.

const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
}))

const mockSendAlertEmail = vi.fn()

vi.mock('@/lib/resend', () => ({
  sendAlertEmail: (...args: unknown[]) => mockSendAlertEmail(...args),
}))

// Import route handler AFTER mocks are in place
import { POST } from '@/app/api/cron/send-alerts/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-cron-secret-abc'

function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) {
    headers['authorization'] = authHeader
  }
  return new NextRequest('http://localhost/api/cron/send-alerts', {
    method: 'POST',
    headers,
  })
}

/**
 * Build a Supabase query chain stub that resolves to { data, error }.
 * Supports the chained patterns used in send-alerts/route.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChain(result: { data: unknown; error: unknown }): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue(result),
    in: vi.fn().mockResolvedValue(result),
    // Thenability
    then: (resolve: (v: unknown) => void) => resolve(result),
    catch: () => Promise.resolve(result),
  }
  return chain
}

// ─── Fixture data ─────────────────────────────────────────────────────────────

const fakeMeeting = {
  id: 'meeting-1',
  title: 'March 2026 Board Meeting',
  body: 'FCPS School Board',
  meeting_date: '2026-03-04',
}

const fakeSummary = {
  meeting_id: 'meeting-1',
  summary_text: 'The board discussed the FY2027 budget proposal.',
  topics: ['Budget', 'Staffing'],
  key_decisions: [{ decision: 'Budget approved unanimously.' }],
  action_items: [{ item: 'Publish final budget document.' }],
}

const fakeAlert = {
  id: 'alert-1',
  user_id: 'user-1',
  keyword: 'budget',
  bodies: null, // no body filter → matches all
}

const fakeUserProfile = {
  id: 'user-1',
  email: 'voter@example.com',
}

// ─── setupEnv / teardown ─────────────────────────────────────────────────────

function withCronSecret(fn: () => void) {
  const original = process.env.CRON_SECRET
  process.env.CRON_SECRET = CRON_SECRET
  try {
    fn()
  } finally {
    process.env.CRON_SECRET = original
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/cron/send-alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET
    mockSendAlertEmail.mockResolvedValue({ data: { id: 'email-ok' }, error: null })
  })

  afterEach(() => {
    delete process.env.CRON_SECRET
  })

  // ── Authorization ──────────────────────────────────────────────────────────

  it('returns 401 when Authorization header is missing', async () => {
    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when Authorization header has wrong token', async () => {
    const res = await POST(makeRequest('Bearer wrong-secret'))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when Authorization header omits Bearer prefix', async () => {
    const res = await POST(makeRequest(CRON_SECRET))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when CRON_SECRET env var is not set', async () => {
    delete process.env.CRON_SECRET

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when empty string is passed as authorization', async () => {
    const res = await POST(makeRequest(''))

    expect(res.status).toBe(401)
  })

  // ── No recent meetings ──────────────────────────────────────────────────────

  it('returns { message, sent: 0 } when no recent meetings exist', async () => {
    // meetings query → empty
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [], error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(body.message).toContain('No recent meetings')
  })

  it('returns { message, sent: 0 } when recent meetings is null', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(0)
  })

  // ── No active alerts ────────────────────────────────────────────────────────

  it('returns { message, sent: 0 } when there are no active alerts', async () => {
    // meetings → one result
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    // summaries
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    // alerts → empty
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [], error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(body.message).toContain('No active alerts')
  })

  // ── DB errors ──────────────────────────────────────────────────────────────

  it('returns 500 when meetings query fails', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('db error') }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch meetings')
  })

  it('returns 500 when summaries query fails', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('summaries err') }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch summaries')
  })

  it('returns 500 when alerts query fails', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('alerts err') }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch alerts')
  })

  it('returns 500 when user profiles query fails', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('users err') }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch user profiles')
  })

  // ── Keyword matching ───────────────────────────────────────────────────────

  it('sends email when keyword matches summary_text', async () => {
    // summary_text contains 'budget'
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    // alert_history insert
    const historyChain = makeChain({ data: null, error: null })
    mockAdminFrom.mockReturnValueOnce(historyChain)

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    expect(mockSendAlertEmail).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body.sent).toBe(1)
  })

  it('does NOT send email when keyword is not in any searchable field', async () => {
    const noMatchAlert = { ...fakeAlert, keyword: 'renovation' }

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [noMatchAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    expect(mockSendAlertEmail).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.sent).toBe(0)
  })

  it('matches keyword case-insensitively', async () => {
    // Keyword stored as 'BUDGET' (uppercase) should still match lowercase summary
    const upperAlert = { ...fakeAlert, keyword: 'BUDGET' }

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [upperAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    expect(mockSendAlertEmail).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body.sent).toBe(1)
  })

  it('matches keyword in topics field', async () => {
    const topicSummary = {
      ...fakeSummary,
      summary_text: 'General discussion.',
      topics: ['Transportation', 'Bridge Repair'],
      key_decisions: [],
      action_items: [],
    }
    const bridgeAlert = { ...fakeAlert, keyword: 'bridge' }

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [topicSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [bridgeAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendAlertEmail).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body.sent).toBe(1)
  })

  it('matches keyword in key_decisions field', async () => {
    const decisionSummary = {
      ...fakeSummary,
      summary_text: 'Various items discussed.',
      topics: [],
      key_decisions: [{ decision: 'Approved new zoning ordinance.' }],
      action_items: [],
    }
    const zoningAlert = { ...fakeAlert, keyword: 'zoning' }

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [decisionSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [zoningAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendAlertEmail).toHaveBeenCalledOnce()
  })

  it('matches keyword in action_items field', async () => {
    const actionSummary = {
      ...fakeSummary,
      summary_text: 'Routine updates.',
      topics: [],
      key_decisions: [],
      action_items: [{ item: 'Hire additional crossing guards.' }],
    }
    const crossingAlert = { ...fakeAlert, keyword: 'crossing' }

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [actionSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [crossingAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendAlertEmail).toHaveBeenCalledOnce()
  })

  // ── Bodies filter logic ───────────────────────────────────────────────────

  it('sends email when alert.bodies is empty (matches all meeting bodies)', async () => {
    const noBodyFilterAlert = { ...fakeAlert, bodies: [] }

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [noBodyFilterAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendAlertEmail).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body.sent).toBe(1)
  })

  it('sends email when alert.bodies includes the meeting body', async () => {
    const bodyFilterAlert = { ...fakeAlert, bodies: ['FCPS School Board'] }

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [bodyFilterAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendAlertEmail).toHaveBeenCalledOnce()
  })

  it('skips email when alert.bodies does NOT include the meeting body', async () => {
    const bodyFilterAlert = { ...fakeAlert, bodies: ['Board of Supervisors'] }

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null })) // meeting.body = 'FCPS School Board'
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [bodyFilterAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendAlertEmail).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.sent).toBe(0)
  })

  // ── Duplicate prevention ──────────────────────────────────────────────────

  it('sends at most one email per user per meeting even with multiple matching alerts', async () => {
    // Two alerts for the same user, both matching the same meeting
    const alert1 = { id: 'alert-1', user_id: 'user-1', keyword: 'budget', bodies: null }
    const alert2 = { id: 'alert-2', user_id: 'user-1', keyword: 'fy2027', bodies: null }
    const summaryWithBoth = {
      ...fakeSummary,
      summary_text: 'The board discussed the FY2027 budget proposal.',
    }

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [summaryWithBoth], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [alert1, alert2], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    // Only one history insert expected
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendAlertEmail).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body.sent).toBe(1)
  })

  it('sends separate emails to different users for the same meeting', async () => {
    const alert1 = { id: 'alert-1', user_id: 'user-1', keyword: 'budget', bodies: null }
    const alert2 = { id: 'alert-2', user_id: 'user-2', keyword: 'budget', bodies: null }
    const userProfiles = [
      { id: 'user-1', email: 'voter1@example.com' },
      { id: 'user-2', email: 'voter2@example.com' },
    ]

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [alert1, alert2], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: userProfiles, error: null }))
    // Two history inserts
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendAlertEmail).toHaveBeenCalledTimes(2)
    const body = await res.json()
    expect(body.sent).toBe(2)
  })

  // ── Email sending and history recording ───────────────────────────────────

  it('records alert_history with email_status "sent" after successful send', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    const historyChain = makeChain({ data: null, error: null })
    mockAdminFrom.mockReturnValueOnce(historyChain)

    await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    const insertCall = historyChain.insert.mock.calls[0][0]
    expect(insertCall.email_status).toBe('sent')
    expect(insertCall.user_id).toBe(fakeAlert.user_id)
    expect(insertCall.meeting_id).toBe(fakeMeeting.id)
    expect(insertCall.alert_preference_id).toBe(fakeAlert.id)
  })

  it('records alert_history with email_status "failed" when sendAlertEmail throws', async () => {
    mockSendAlertEmail.mockRejectedValueOnce(new Error('Resend API error'))

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    const failHistoryChain = makeChain({ data: null, error: null })
    mockAdminFrom.mockReturnValueOnce(failHistoryChain)

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    const insertCall = failHistoryChain.insert.mock.calls[0][0]
    expect(insertCall.email_status).toBe('failed')
    const body = await res.json()
    expect(body.sent).toBe(0)
  })

  it('continues processing other alerts when one email send fails', async () => {
    const alert1 = { id: 'alert-1', user_id: 'user-1', keyword: 'budget', bodies: null }
    const alert2 = { id: 'alert-2', user_id: 'user-2', keyword: 'budget', bodies: null }
    const userProfiles = [
      { id: 'user-1', email: 'voter1@example.com' },
      { id: 'user-2', email: 'voter2@example.com' },
    ]

    // First send fails, second succeeds
    mockSendAlertEmail
      .mockRejectedValueOnce(new Error('send failed'))
      .mockResolvedValueOnce({ data: { id: 'ok' }, error: null })

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [alert1, alert2], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: userProfiles, error: null }))
    // failed history for alert1
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))
    // sent history for alert2
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    expect(mockSendAlertEmail).toHaveBeenCalledTimes(2)
    const body = await res.json()
    expect(body.sent).toBe(1)
  })

  it('skips email when user profile email is not found', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeAlert], error: null }))
    // user profile not present for this user_id
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [], error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendAlertEmail).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.sent).toBe(0)
  })

  // ── Response format ───────────────────────────────────────────────────────

  it('returns { message, sent, processed } on successful run', async () => {
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('message', 'Alert processing complete')
    expect(body).toHaveProperty('sent', 1)
    expect(body).toHaveProperty('processed', 1)
  })

  it('processed field reflects the number of recent meetings fetched', async () => {
    const meetings = [
      { id: 'm1', title: 'Meeting 1', body: 'FCPS School Board', meeting_date: '2026-03-01' },
      { id: 'm2', title: 'Meeting 2', body: 'FCPS School Board', meeting_date: '2026-03-02' },
    ]
    const summaries = [
      { ...fakeSummary, meeting_id: 'm1' },
      { ...fakeSummary, meeting_id: 'm2' },
    ]
    // Keyword 'budget' matches both summaries but same user → 2 emails (one per meeting)
    const twoUserAlerts = [
      { id: 'alert-u1-m', user_id: 'user-1', keyword: 'budget', bodies: null },
    ]
    const twoUserProfiles = [{ id: 'user-1', email: 'voter@example.com' }]

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: meetings, error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: summaries, error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: twoUserAlerts, error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: twoUserProfiles, error: null }))
    // history insert for m1
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))
    // history insert for m2
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    const body = await res.json()
    expect(body.processed).toBe(2)
    // One email per meeting for the single user (duplicate guard is per-meeting)
    expect(body.sent).toBe(2)
  })

  it('skips meeting if no summary exists for it', async () => {
    // Meeting present but no corresponding summary
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [], error: null })) // empty summaries
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))

    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendAlertEmail).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.sent).toBe(0)
  })

  // ── sendAlertEmail call correctness ───────────────────────────────────────

  it('passes correct params to sendAlertEmail', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://civiccycle.net'

    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeMeeting], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeSummary], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeAlert], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: [fakeUserProfile], error: null }))
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    await POST(makeRequest(`Bearer ${CRON_SECRET}`))

    expect(mockSendAlertEmail).toHaveBeenCalledOnce()
    const call = mockSendAlertEmail.mock.calls[0][0]
    expect(call.to).toBe(fakeUserProfile.email)
    expect(call.keyword).toBe(fakeAlert.keyword)
    expect(call.meetingTitle).toBe(fakeMeeting.title)
    expect(call.meetingBody).toBe(fakeMeeting.body)
    expect(call.meetingUrl).toContain(fakeMeeting.id)
    expect(call.unsubscribeUrl).toContain(fakeAlert.id)

    delete process.env.NEXT_PUBLIC_APP_URL
  })
})
