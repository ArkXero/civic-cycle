import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/account-profile'
import {
  AUTH_REDIRECT_COOKIE,
  buildAuthCallbackUrl,
  getRequestOrigin,
} from '@/lib/auth/redirects'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)

  if (!user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = getRequestOrigin(request)
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: buildAuthCallbackUrl(origin, '/settings'),
  })

  if (error) {
    console.error('password reset request failed:', error)
    return NextResponse.json(
      { error: 'Failed to send password reset email' },
      { status: 500 }
    )
  }

  const response = NextResponse.json({ message: 'Password reset email sent' })
  response.cookies.set(AUTH_REDIRECT_COOKIE, '/settings', {
    path: '/',
    maxAge: 60 * 60,
    sameSite: 'lax',
    secure: origin.startsWith('https://'),
  })
  return response
}
