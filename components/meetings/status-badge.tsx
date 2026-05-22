import { Badge } from '@/components/ui/badge'
import type { MeetingStatus } from '@/types'

const VARIANTS: Record<MeetingStatus, { variant?: 'secondary' | 'outline' | 'destructive'; className?: string; label: string }> = {
  pending: { variant: 'secondary', label: 'Pending' },
  processing: { variant: 'outline', className: 'text-yellow-600 border-yellow-600', label: 'Processing' },
  summarized: { className: 'bg-green-600 text-white', label: 'Summarized' },
  failed: { variant: 'destructive', label: 'Failed' },
}

function isMeetingStatus(status: string): status is MeetingStatus {
  return status in VARIANTS
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status || !isMeetingStatus(status)) return null
  const { variant, className, label } = VARIANTS[status]
  return <Badge variant={variant} className={className}>{label}</Badge>
}
