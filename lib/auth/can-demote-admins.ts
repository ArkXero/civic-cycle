const DEMOTE_ADMIN_EMAILS = new Set([
  'memeronite@gmail.com',
  'singh.ronit2028@gmail.com',
])

export function canDemoteAdmins(email: string | null | undefined) {
  return email ? DEMOTE_ADMIN_EMAILS.has(email.toLowerCase()) : false
}
