import { createClient } from '@/lib/supabase/server'
import type { MeetingWithSummary } from '@/types'
import { DitheringHero } from '@/components/ui/hero-dithering-card'
import FeaturesBento from '@/components/features/FeaturesBento'
import { RecentMeetingsSection, HomeCtaSection } from './_home-client'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('meetings')
    .select('*, summary:summaries(*)')
    .eq('status', 'summarized')
    .order('meeting_date', { ascending: false })
    .limit(3)

  const meetings: MeetingWithSummary[] = (data ?? []).map((m) => {
    const row = m as { summary?: unknown[] }
    return Object.assign({}, m, { summary: row.summary?.[0] ?? null }) as MeetingWithSummary
  })

  return (
    <div className="bg-background">
      <DitheringHero />
      <RecentMeetingsSection meetings={meetings} />
      <FeaturesBento />
      <HomeCtaSection />
    </div>
  )
}
