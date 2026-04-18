import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAdminJwt } from '@/lib/auth/get-role'

/**
 * Extract the best available client IP from standard proxy headers.
 * Falls back to a sentinel so rate limiting still applies.
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

/**
 * Extract the Supabase access token from cookies.
 * The cookie name is derived from NEXT_PUBLIC_SUPABASE_URL.
 * Returns null if no valid session cookie is found.
 */
function getSupabaseAccessToken(request: NextRequest): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`
  const raw = request.cookies.get(cookieName)?.value
  if (!raw) return null
  try {
    const session = JSON.parse(decodeURIComponent(raw))
    return (session.access_token as string) ?? null
  } catch {
    return null
  }
}

/**
 * Return a 429 JSON response with a Retry-After header.
 */
function tooManyRequests(resetMs: number): NextResponse {
  const retryAfterSecs = Math.ceil((resetMs - Date.now()) / 1000)
  return new NextResponse(
    JSON.stringify({ error: 'Too many requests. Please slow down and try again.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSecs),
      },
    }
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIp(request)

  // --- Rate limiting for API routes ---
  if (pathname.startsWith('/api/')) {
    // Stricter limits on write-heavy / sensitive endpoints
    if (
      pathname.startsWith('/api/alerts') ||
      pathname.startsWith('/api/meetings') ||
      pathname.startsWith('/api/boarddocs') ||
      pathname.startsWith('/api/admin')
    ) {
      // 30 requests per minute per IP for mutation-heavy and admin routes
      const { allowed, reset } = checkRateLimit(`api-write:${ip}`, 30, 60_000)
      if (!allowed) return tooManyRequests(reset)
    }

    // General API budget: 120 requests per minute per IP
    const { allowed, reset } = checkRateLimit(`api:${ip}`, 120, 60_000)
    if (!allowed) return tooManyRequests(reset)

    // CORS: block cross-origin API requests
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')
    if (origin) {
      try {
        const originHost = new URL(origin).host
        if (originHost !== host) {
          return new NextResponse(null, { status: 403 })
        }
      } catch {
        return new NextResponse(null, { status: 403 })
      }
    }
  }

  // Supabase session refresh + route protection (handles login redirects)
  const response = await updateSession(request)

  // UX-only admin guard for /admin page routes.
  // API routes under /api/admin enforce their own auth — no redirect needed there.
  // If updateSession already issued a redirect (e.g. to /auth/login), respect it.
  if (
    pathname.startsWith('/admin') &&
    !pathname.startsWith('/api') &&
    response.status !== 307 &&
    response.status !== 308
  ) {
    const accessToken = getSupabaseAccessToken(request)
    // accessToken present means the user is logged in; check their role.
    // If no token, updateSession already redirected to login above.
    if (accessToken && !isAdminJwt(accessToken)) {
      const url = request.nextUrl.clone()
      url.pathname = '/unauthorized'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
