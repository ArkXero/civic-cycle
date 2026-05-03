import { Badge } from '@/components/ui/badge'
import type { MeetingStatus } from '@/types'

const VARIANTS: Record<MeetingStatus, { variant?: 'secondary' | 'outline' | 'destructive'; className?: string; label: string }> = {
  pending: { variant: 'secondary', label: 'Pending' },
  processing: { variant: 'outline', className: 'text-yellow-600 border-yellow-600', label: 'Processing' },
  summarized: { className: 'bg-green-600 text-white', label: 'Summarized' },
  failed: { variant: 'destructive', label: 'Failed' },
}

export function StatusBadge({ status }: { status: MeetingStatus | string | null | undefined }) {
  if (!status || !(status in VARIANTS)) return null
  const { variant, className, label } = VARIANTS[status as MeetingStatus]
  return <Badge variant={variant} className={className}>{label}</Badge>
}
