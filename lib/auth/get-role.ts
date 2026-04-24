/**
 * JWT role helpers — for client components and middleware ONLY.
 * These decode without signature verification and are UX-only.
 * Server-side security checks must always query the database directly.
 */

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    if (!payload) return {}
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(padded))
  } catch {
    return {}
  }
}

/** Extract `user_role` from a raw JWT access token string. Defaults to 'user'. */
export function getRoleFromJwt(accessToken: string): string {
  return (decodeJwt(accessToken).user_role as string) ?? 'user'
}

/** Returns true if the JWT contains `user_role: 'admin'`. */
export function isAdminJwt(accessToken: string): boolean {
  return getRoleFromJwt(accessToken) === 'admin'
}

/** Extract `email` from a raw JWT access token string. Returns null if absent. */
export function getEmailFromJwt(accessToken: string): string | null {
  return (decodeJwt(accessToken).email as string) ?? null
}
