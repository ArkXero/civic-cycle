import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { AuthTokenResponse } from '@supabase/supabase-js'
import {
  AUTH_PENDING_DISTRICT_COOKIE,
  AUTH_REDIRECT_COOKIE,
  DEFAULT_POST_AUTH_REDIRECT_PATH,
  getLocalAuthCallbackRelayOrigin,
  getRequestOrigin,
  readAuthRedirectCookie,
  readPendingDistrictCookie,
  sanitizeRedirectPath,
} from '@/lib/auth/redirects'
import { chooseCountyRedirectPath } from '@/lib/account-profile'
import { isSchoolDistrictId } from '@/lib/school-districts'
import { NextResponse } from 'next/server'

type AuthCodeExchangeData = AuthTokenResponse['data'] & {
  redirectType?: string | null
}

function redirectToLogin(origin: string, reason: string) {
  const loginUrl = new URL('/auth/login', origin)
  loginUrl.searchParams.set('error', 'auth')
  loginUrl.searchParams.set('reason', reason)
  return NextResponse.redirect(loginUrl)
}

async function getOrApplyPreferredDistrict(
  userId: string,
  email: string | undefined,
  pendingDistrictId: string | null
) {
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (adminClient as any)
    .from('user_profiles')
    .select('preferred_district_id')
    .eq('id', userId)
    .maybeSingle() as {
      data: { preferred_district_id: string | null } | null
    }

  if (profile?.preferred_district_id) {
    return profile.preferred_district_id
  }

  if (!pendingDistrictId) {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient as any)
    .from('user_profiles')
    .upsert({
      id: userId,
      email: email ?? '',
      preferred_district_id: pendingDistrictId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient as any)
    .from('digest_subscribers')
    .update({ district_id: pendingDistrictId })
    .eq('user_id', userId)

  return pendingDistrictId
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = getRequestOrigin(request)

  const code = searchParams.get('code')
  const providerError = searchParams.get('error')
  const providerErrorCode = searchParams.get('error_code')
  const providerErrorDescription = searchParams.get('error_description')
  const cookieHeader = request.headers.get('cookie')
  const pendingDistrictId = readPendingDistrictCookie(cookieHeader)
  const redirectTo = sanitizeRedirectPath(
    searchParams.get('redirectTo') ?? readAuthRedirectCookie(cookieHeader)
  )
  const postAuthRedirectTo = sanitizeRedirectPath(
    searchParams.get('redirectTo') ??
      readAuthRedirectCookie(cookieHeader, DEFAULT_POST_AUTH_REDIRECT_PATH),
    DEFAULT_POST_AUTH_REDIRECT_PATH
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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const exchangeData = data as AuthCodeExchangeData
      const metadataDistrictId = data.user?.user_metadata?.preferred_district_id
      const districtToApply = pendingDistrictId ??
        (isSchoolDistrictId(metadataDistrictId) ? metadataDistrictId : null)
      const preferredDistrictId = data.user
        ? await getOrApplyPreferredDistrict(data.user.id, data.user.email, districtToApply)
        : null
      const nextPath =
        exchangeData.redirectType === 'recovery'
          ? `/auth/reset-password?redirectTo=${encodeURIComponent(postAuthRedirectTo)}`
          : preferredDistrictId
            ? redirectTo
            : chooseCountyRedirectPath(redirectTo)
      const response = NextResponse.redirect(`${origin}${nextPath}`)
      response.cookies.set(AUTH_REDIRECT_COOKIE, '', { path: '/', maxAge: 0 })
      response.cookies.set(AUTH_PENDING_DISTRICT_COOKIE, '', { path: '/', maxAge: 0 })
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
