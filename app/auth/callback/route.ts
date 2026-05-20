import { createClient } from '@/lib/supabase/server'
import {
  AUTH_REDIRECT_COOKIE,
  getLocalAuthCallbackRelayOrigin,
  getRequestOrigin,
  readAuthRedirectCookie,
  sanitizeRedirectPath,
} from '@/lib/auth/redirects'
import { NextResponse } from 'next/server'

function redirectToLogin(origin: string, reason: string) {
  const loginUrl = new URL('/auth/login', origin)
  loginUrl.searchParams.set('error', 'auth')
  loginUrl.searchParams.set('reason', reason)
  return NextResponse.redirect(loginUrl)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = getRequestOrigin(request)

  const code = searchParams.get('code')
  const providerError = searchParams.get('error')
  const providerErrorCode = searchParams.get('error_code')
  const providerErrorDescription = searchParams.get('error_description')
  const redirectTo = sanitizeRedirectPath(
    searchParams.get('redirectTo') ?? readAuthRedirectCookie(request.headers.get('cookie'))
  )
  const relayOrigin = getLocalAuthCallbackRelayOrigin(searchParams.get('origin'), origin)

  if (code && relayOrigin) {
    const callbackUrl = new URL('/auth/callback', relayOrigin)
    callbackUrl.searchParams.set('code', code)
    callbackUrl.searchParams.set('redirectTo', redirectTo)
    return NextResponse.redirect(callbackUrl)
  }

  if (providerError) {
    console.error('Supabase OAuth callback returned an error', {
      error: providerError,
      errorCode: providerErrorCode,
      errorDescription: providerErrorDescription,
      origin,
    })
    return redirectToLogin(relayOrigin ?? origin, 'provider')
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const response = NextResponse.redirect(`${origin}${redirectTo}`)
      response.cookies.set(AUTH_REDIRECT_COOKIE, '', { path: '/', maxAge: 0 })
      return response
    }

    console.error('Supabase OAuth code exchange failed', {
      message: error.message,
      status: error.status,
      code: error.code,
      origin,
    })
    return redirectToLogin(origin, 'exchange')
  }

  return redirectToLogin(relayOrigin ?? origin, 'missing_code')
}
