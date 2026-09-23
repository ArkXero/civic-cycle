import { MotionTimeline } from '@/components/meetings/motion-timeline'

export default function MeetingLoading() {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="h-10 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-40 animate-pulse rounded-lg bg-muted" />
      <MotionTimeline motions={[]} legacyDecisions={[]} loading />
    </div>
  )
}
