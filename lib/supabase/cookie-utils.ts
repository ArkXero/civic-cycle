export function hardenCookieOptions(options: Record<string, unknown> | undefined) {
  return {
    ...options,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}
