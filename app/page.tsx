import { createClient } from '@/lib/supabase/server'
import { getMeetingList } from '@/lib/data/meetings'
import { getPreferredDistrictId } from '@/lib/account-profile'
import { redirect } from 'next/navigation'
import { HeroClean } from '@/components/ui/hero-clean'
import FeaturesSection from '@/components/features/FeaturesBento'
import { RecentMeetingsSection, HomeCtaSection } from './_home-client'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

interface HomeProps {
  searchParams: SearchParams
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getSafeRedirectTo(rawRedirect: string | undefined) {
  if (rawRedirect?.startsWith('/') && !rawRedirect.startsWith('//')) {
    return rawRedirect
  }

  return undefined
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams
  const code = firstParam(params.code)

  if (code) {
    const callbackParams = new URLSearchParams({ code })
    const redirectTo = getSafeRedirectTo(firstParam(params.redirectTo))

    if (redirectTo) {
      callbackParams.set('redirectTo', redirectTo)
    }

    redirect(`/auth/callback?${callbackParams.toString()}`)
  }

  const supabase = await createClient()
  const districtId = await getPreferredDistrictId(supabase, firstParam(params.districtId))
  const { meetings } = await getMeetingList(supabase, {
    page: 1,
    pageSize: 3,
    statusFilter: 'summarized',
    districtId,
  })

  return (
    <div className="bg-background">
      <HeroClean districtId={districtId} />
      <RecentMeetingsSection meetings={meetings} districtId={districtId} />
      <FeaturesSection />
      <HomeCtaSection />
    </div>
  )
}
