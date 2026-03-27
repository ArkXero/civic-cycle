/**
 * Returns true if `email` is in the ADMIN_EMAILS environment variable.
 *
 * Set ADMIN_EMAILS in your .env.local as a comma-separated list:
 *   ADMIN_EMAILS=alice@example.com,bob@example.com
 *
 * This is a server-side-only module — never import from client components.
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false
  const raw = process.env.ADMIN_EMAILS ?? ''
  if (!raw.trim()) return false
  const allowed = raw.split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email.trim().toLowerCase())
}
