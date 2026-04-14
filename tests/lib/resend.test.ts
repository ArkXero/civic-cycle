import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures mockSend is available inside vi.mock factory
const mockSend = vi.hoisted(() => vi.fn())

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend }
  },
}))

// Import AFTER mocks are in place
import { sendAlertEmail } from '@/lib/resend'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const baseParams = {
  to: 'user@example.com',
  keyword: 'budget',
  meetingTitle: 'March 2026 Board Meeting',
  meetingDate: 'March 4, 2026',
  meetingBody: 'FCPS School Board',
  summaryExcerpt: 'The board discussed the FY2027 budget in detail.',
  meetingUrl: 'https://example.com/meetings/abc-123',
  unsubscribeUrl: 'https://example.com/unsubscribe/alert-456',
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('sendAlertEmail', () => {
  beforeEach(() => {
    mockSend.mockReset()
    mockSend.mockResolvedValue({ data: { id: 'email-id-1' }, error: null })
  })

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('calls resend.emails.send with correct fields', async () => {
    await sendAlertEmail(baseParams)

    expect(mockSend).toHaveBeenCalledOnce()
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('user@example.com')
    expect(call.subject).toContain('"budget"')
    expect(call.subject).toContain('FCPS School Board')
    expect(call.html).toBeTruthy()
    expect(call.text).toBeTruthy()
  })

  it('sets the from field to include Civic Cycle branding', async () => {
    await sendAlertEmail(baseParams)

    const call = mockSend.mock.calls[0][0]
    expect(call.from).toContain('Civic Cycle')
  })

  it('includes the meeting title in both html and text', async () => {
    await sendAlertEmail(baseParams)

    const { html, text } = mockSend.mock.calls[0][0]
    expect(html).toContain('March 2026 Board Meeting')
    expect(text).toContain('March 2026 Board Meeting')
  })

  it('includes the keyword in both html and text', async () => {
    await sendAlertEmail(baseParams)

    const { html, text } = mockSend.mock.calls[0][0]
    expect(html).toContain('budget')
    expect(text).toContain('budget')
  })

  it('includes the summary excerpt in both html and text', async () => {
    await sendAlertEmail(baseParams)

    const { html, text } = mockSend.mock.calls[0][0]
    expect(html).toContain('FY2027 budget in detail')
    expect(text).toContain('FY2027 budget in detail')
  })

  it('includes the meeting URL in both html and text', async () => {
    await sendAlertEmail(baseParams)

    const { html, text } = mockSend.mock.calls[0][0]
    expect(html).toContain('https://example.com/meetings/abc-123')
    expect(text).toContain('https://example.com/meetings/abc-123')
  })

  it('includes the unsubscribe URL in both html and text', async () => {
    await sendAlertEmail(baseParams)

    const { html, text } = mockSend.mock.calls[0][0]
    expect(html).toContain('https://example.com/unsubscribe/alert-456')
    expect(text).toContain('https://example.com/unsubscribe/alert-456')
  })

  it('returns the resend API response', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-abc' }, error: null })

    const result = await sendAlertEmail(baseParams)

    expect(result).toEqual({ data: { id: 'email-abc' }, error: null })
  })

  // ── HTML/text escaping (XSS prevention) ────────────────────────────────────

  it('escapes < and > in keyword to prevent HTML injection', async () => {
    await sendAlertEmail({ ...baseParams, keyword: '<script>alert(1)</script>' })

    const { html } = mockSend.mock.calls[0][0]
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes & in meeting title', async () => {
    await sendAlertEmail({ ...baseParams, meetingTitle: 'Bonds & Budgets Meeting' })

    const { html } = mockSend.mock.calls[0][0]
    expect(html).toContain('&amp;')
    expect(html).not.toMatch(/Bonds & Budgets/)
  })

  it('escapes double quotes in summary excerpt', async () => {
    await sendAlertEmail({ ...baseParams, summaryExcerpt: 'He said "yes" unanimously.' })

    const { html } = mockSend.mock.calls[0][0]
    expect(html).toContain('&quot;')
  })

  it('escapes single quotes in keyword', async () => {
    await sendAlertEmail({ ...baseParams, keyword: "it's urgent" })

    const { html } = mockSend.mock.calls[0][0]
    expect(html).toContain('&#x27;')
  })

  it('escapes the meeting body name in html', async () => {
    await sendAlertEmail({ ...baseParams, meetingBody: '<Board>' })

    const { html } = mockSend.mock.calls[0][0]
    expect(html).not.toContain('<Board>')
    expect(html).toContain('&lt;Board&gt;')
  })

  // ── URL validation (only http/https allowed) ────────────────────────────────

  it('uses meetingUrl as-is when it starts with https://', async () => {
    await sendAlertEmail({ ...baseParams, meetingUrl: 'https://example.com/meetings/1' })

    const { html } = mockSend.mock.calls[0][0]
    expect(html).toContain('href="https://example.com/meetings/1"')
  })

  it('uses meetingUrl as-is when it starts with http://', async () => {
    await sendAlertEmail({ ...baseParams, meetingUrl: 'http://localhost:3000/meetings/1' })

    const { html } = mockSend.mock.calls[0][0]
    expect(html).toContain('href="http://localhost:3000/meetings/1"')
  })

  it('replaces javascript: meetingUrl with # to block XSS', async () => {
    await sendAlertEmail({ ...baseParams, meetingUrl: 'javascript:alert(1)' })

    const { html } = mockSend.mock.calls[0][0]
    // The safe fallback href must be "#", not the JS payload
    expect(html).not.toContain('href="javascript:alert(1)"')
    expect(html).toContain('href="#"')
  })

  it('replaces data: unsubscribeUrl with # to block XSS', async () => {
    await sendAlertEmail({ ...baseParams, unsubscribeUrl: 'data:text/html,<h1>phish</h1>' })

    const { html } = mockSend.mock.calls[0][0]
    expect(html).not.toContain('href="data:')
    expect(html).toContain('href="#"')
  })

  it('replaces vbscript: unsubscribeUrl with #', async () => {
    await sendAlertEmail({ ...baseParams, unsubscribeUrl: 'vbscript:MsgBox(1)' })

    const { html } = mockSend.mock.calls[0][0]
    expect(html).not.toContain('vbscript:')
    expect(html).toContain('href="#"')
  })

  // ── Error handling ──────────────────────────────────────────────────────────

  it('propagates errors thrown by the Resend SDK', async () => {
    mockSend.mockRejectedValue(new Error('Resend API rate limit exceeded'))

    await expect(sendAlertEmail(baseParams)).rejects.toThrow('Resend API rate limit exceeded')
  })

  it('propagates network errors from the Resend SDK', async () => {
    mockSend.mockRejectedValue(new TypeError('fetch failed'))

    await expect(sendAlertEmail(baseParams)).rejects.toThrow('fetch failed')
  })
})
