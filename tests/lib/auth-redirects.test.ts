import { describe, expect, it } from 'vitest'

import {
  buildAuthCallbackUrl,
  getLocalAuthCallbackRelayOrigin,
  getRequestOrigin,
  oauthUrlMatchesCallbackOrigin,
  readAuthRedirectCookie,
  sanitizeRedirectPath,
} from '@/lib/auth/redirects'

describe('auth redirects', () => {
  it('keeps relative redirect paths and strips absolute URLs', () => {
    expect(sanitizeRedirectPath('/alerts?tab=mine#top')).toBe('/alerts?tab=mine#top')
    expect(sanitizeRedirectPath('https://civiccycle.net/alerts')).toBe('/')
    expect(sanitizeRedirectPath('//civiccycle.net/alerts')).toBe('/')
    expect(sanitizeRedirectPath(undefined)).toBe('/')
  })

  it('builds query-free localhost callback URLs', () => {
    const callbackUrl = new URL(buildAuthCallbackUrl('http://localhost:3000', '/alerts'))

    expect(callbackUrl.origin).toBe('http://localhost:3000')
    expect(callbackUrl.pathname).toBe('/auth/callback')
    expect(callbackUrl.search).toBe('')
  })

  it('builds query-free production callback URLs', () => {
    const callbackUrl = new URL(buildAuthCallbackUrl('https://civiccycle.net', '/alerts'))

    expect(callbackUrl.origin).toBe('https://civiccycle.net')
    expect(callbackUrl.search).toBe('')
  })

  it('detects OAuth URLs that would complete on another app host', () => {
    const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    oauthUrl.searchParams.set('redirect_to', 'https://civiccycle.net/auth/callback')

    expect(oauthUrlMatchesCallbackOrigin(oauthUrl.toString(), 'http://localhost:3000')).toBe(false)
  })

  it('rejects OAuth URLs that do not expose the callback destination', () => {
    const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')

    expect(oauthUrlMatchesCallbackOrigin(oauthUrl.toString(), 'http://localhost:3000')).toBe(false)
  })

  it('keeps localhost as the request origin even if forwarded headers are present', () => {
    const request = new Request('http://localhost:3000/auth/callback', {
      headers: {
        'x-forwarded-host': 'civiccycle.net',
        'x-forwarded-proto': 'https',
      },
    })

    expect(getRequestOrigin(request)).toBe('http://localhost:3000')
  })

  it('uses forwarded headers for proxied production requests', () => {
    const request = new Request('http://0.0.0.0:3000/auth/callback', {
      headers: {
        'x-forwarded-host': 'civiccycle.net',
        'x-forwarded-proto': 'https',
      },
    })

    expect(getRequestOrigin(request)).toBe('https://civiccycle.net')
  })

  it('allows relaying a production callback back to the localhost origin that started auth', () => {
    expect(
      getLocalAuthCallbackRelayOrigin('http://localhost:3000', 'https://civiccycle.net')
    ).toBe('http://localhost:3000')
    expect(
      getLocalAuthCallbackRelayOrigin('https://evil.example', 'https://civiccycle.net')
    ).toBeNull()
  })

  it('reads and sanitizes the auth redirect cookie', () => {
    expect(readAuthRedirectCookie('other=1; cc_auth_redirect_to=%2Falerts%3Ftab%3Dmine')).toBe('/alerts?tab=mine')
    expect(readAuthRedirectCookie('cc_auth_redirect_to=https%3A%2F%2Fevil.example%2Falerts')).toBe('/')
  })

  it('falls back when the auth redirect cookie is malformed', () => {
    expect(readAuthRedirectCookie('cc_auth_redirect_to=%E0%A4%A')).toBe('/')
  })
})
