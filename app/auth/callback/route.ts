import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // Behind Caddy + Cloudflare the internal URL is http://0.0.0.0:3000.
  // Use forwarded headers to reconstruct the real public origin.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin

  const code = searchParams.get('code')
  const rawRedirect = searchParams.get('redirectTo') || '/'

  // Only allow relative paths that start with / but not // (protocol-relative URLs).
  // This prevents open-redirect attacks where an attacker crafts a link like
  // /auth/callback?redirectTo=https://evil.com after a successful OAuth flow.
  const redirectTo =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successful authentication
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  // Return to login with error if something went wrong
  return NextResponse.redirect(`${origin}/auth/login?error=auth`)
}
