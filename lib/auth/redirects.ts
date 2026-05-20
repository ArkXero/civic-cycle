const DEFAULT_REDIRECT_PATH = '/'
export const AUTH_REDIRECT_COOKIE = 'cc_auth_redirect_to'
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function firstForwardedValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null
}

function isLoopbackHostname(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase())
}

function isHttpProtocol(protocol: string) {
  return protocol === 'http:' || protocol === 'https:'
}

export function sanitizeRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_REDIRECT_PATH
  }

  try {
    const url = new URL(value, 'http://localhost')
    return `${url.pathname}${url.search}${url.hash}` || DEFAULT_REDIRECT_PATH
  } catch {
    return DEFAULT_REDIRECT_PATH
  }
}

export function isLoopbackOrigin(value: string) {
  try {
    const url = new URL(value)
    return isHttpProtocol(url.protocol) && isLoopbackHostname(url.hostname)
  } catch {
    return false
  }
}

export function buildAuthCallbackUrl(origin: string, _redirectTo?: string) {
  const callbackUrl = new URL('/auth/callback', origin)

  // Keep this URL query-free so exact Supabase redirect URL allow-list entries
  // like http://localhost:3000/auth/callback continue to match.
  void _redirectTo
  return callbackUrl.toString()
}

export function storeAuthRedirectPath(redirectTo: string) {
  if (typeof document === 'undefined') return

  const cookieParts = [
    `${AUTH_REDIRECT_COOKIE}=${encodeURIComponent(sanitizeRedirectPath(redirectTo))}`,
    'Path=/',
    'Max-Age=600',
    'SameSite=Lax',
  ]

  if (window.location.protocol === 'https:') {
    cookieParts.push('Secure')
  }

  document.cookie = cookieParts.join('; ')
}

export function readAuthRedirectCookie(cookieHeader: string | null) {
  if (!cookieHeader) return DEFAULT_REDIRECT_PATH

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_REDIRECT_COOKIE}=`))

  if (!cookie) return DEFAULT_REDIRECT_PATH

  return sanitizeRedirectPath(decodeURIComponent(cookie.slice(AUTH_REDIRECT_COOKIE.length + 1)))
}

export function oauthUrlMatchesCallbackOrigin(oauthUrl: string, expectedOrigin: string) {
  try {
    const url = new URL(oauthUrl)
    const redirectTo = url.searchParams.get('redirect_to')

    if (!redirectTo) return false

    return new URL(redirectTo).origin === new URL(expectedOrigin).origin
  } catch {
    return false
  }
}

export function getRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url)

  if (isLoopbackHostname(requestUrl.hostname)) {
    return requestUrl.origin
  }

  const forwardedHost = firstForwardedValue(request.headers.get('x-forwarded-host'))

  if (!forwardedHost) {
    return requestUrl.origin
  }

  const forwardedProto = firstForwardedValue(request.headers.get('x-forwarded-proto'))
  const protocol = forwardedProto === 'http' || forwardedProto === 'https'
    ? forwardedProto
    : 'https'

  return `${protocol}://${forwardedHost}`
}

export function getLocalAuthCallbackRelayOrigin(
  rawOrigin: string | null,
  requestOrigin: string
) {
  if (!rawOrigin || !isLoopbackOrigin(rawOrigin)) {
    return null
  }

  const origin = new URL(rawOrigin).origin

  if (origin === requestOrigin || isLoopbackOrigin(requestOrigin)) {
    return null
  }

  return origin
}
