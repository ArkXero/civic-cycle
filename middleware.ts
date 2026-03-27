import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkRateLimit } from '@/lib/rate-limit'

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
      pathname.startsWith('/api/boarddocs')
    ) {
      // 30 requests per minute per IP for mutation-heavy routes
      const { allowed, reset } = checkRateLimit(`api-write:${ip}`, 30, 60_000)
      if (!allowed) return tooManyRequests(reset)
    }

    // General API budget: 120 requests per minute per IP
    const { allowed, reset } = checkRateLimit(`api:${ip}`, 120, 60_000)
    if (!allowed) return tooManyRequests(reset)
  }

  // Supabase session refresh + route protection
  return await updateSession(request)
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
