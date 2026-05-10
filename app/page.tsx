import { createClient } from '@/lib/supabase/server'
import { getMeetingList } from '@/lib/data/meetings'
import { HeroClean } from '@/components/ui/hero-clean'
import FeaturesSection from '@/components/features/FeaturesBento'
import { RecentMeetingsSection, HomeCtaSection } from './_home-client'

export default async function Home() {
  const supabase = await createClient()
  const { meetings } = await getMeetingList(supabase, {
    page: 1,
    pageSize: 3,
    statusFilter: 'summarized',
  })

  return (
    <div className="bg-background">
      <HeroClean />
      <RecentMeetingsSection meetings={meetings} />
      <FeaturesSection />
      <HomeCtaSection />
    </div>
  )
}
