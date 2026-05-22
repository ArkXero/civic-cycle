export function fmtCost(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return 'Never'

  const timestamp = new Date(iso).getTime()
  if (Number.isNaN(timestamp)) return 'Unknown'

  const secs = Math.floor((Date.now() - timestamp) / 1000)
  if (secs < 60) return 'Just now'
  if (secs < 3_600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86_400) return `${Math.floor(secs / 3_600)}h ago`
  return `${Math.floor(secs / 86_400)}d ago`
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return 'Never'

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatChartDateKey(key: string) {
  const isMonth = /^\d{4}-\d{2}$/.test(key)
  const date = isMonth ? new Date(`${key}-01T00:00:00Z`) : new Date(`${key}T00:00:00Z`)

  if (Number.isNaN(date.getTime())) return key

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: isMonth ? undefined : 'numeric',
    year: isMonth ? '2-digit' : undefined,
  }).format(date)
}
