import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
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
