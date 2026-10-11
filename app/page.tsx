import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getMeetingList } from '@/lib/data/meetings'
import { getMeetingMotionTimeline } from '@/lib/data/motions'
import { loadMotionDigests } from '@/lib/data/motion-digests'
import { getPreferredDistrictId } from '@/lib/account-profile'
import { redirect } from 'next/navigation'
import { HomeHero, RecentMeetingsLedger, AlertsCta, buildHowItWorksDemo } from '@/components/home/home-sections'
import { HowItWorks } from '@/components/home/how-it-works'

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
    pageSize: 6,
    statusFilter: 'summarized',
    districtId,
  })

  const [latest, ...recent] = meetings
  const [latestMotions, digests] = await Promise.all([
    latest
      ? getMeetingMotionTimeline(createAdminClient(), latest.id).catch(() => [])
      : Promise.resolve([]),
    loadMotionDigests(recent.map((meeting) => meeting.id)),
  ])

  return (
    <div className="bg-background">
      <HomeHero
        districtId={districtId}
        latest={latest ?? null}
        latestMotions={latestMotions}
        waveIntoTeal={recent.length > 0}
      />
      <RecentMeetingsLedger meetings={recent} digests={digests} />
      <HowItWorks demo={buildHowItWorksDemo(latest ?? null, latestMotions, recent)} />
      <AlertsCta />
    </div>
  )
}
