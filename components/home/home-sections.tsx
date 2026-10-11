import Link from 'next/link'
import { WaveDivider } from '@/components/home/wave-divider'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { MeetingCard } from '@/components/meetings/meeting-card'
import { groupMotionsByAgendaItem, agendaAnchor, type AgendaGroup } from '@/components/meetings/motion-timeline'
import { VoteSeats, OutcomeStamp } from '@/components/record/vote-seats'
import { cleanAgendaTitle, docketDate, summaryExcerpt } from '@/components/record/format'
import type { HowItWorksDemo } from './how-it-works'
import { ViewingDistrict } from '@/components/school-district/viewing-district'
import { getSchoolDistrict, type SchoolDistrictId } from '@/lib/school-districts'
import type { MeetingWithSummary } from '@/types'
import type { MeetingMotionDigest, MotionTimelineItem } from '@/lib/data/motions'
import { AMBER_CTA } from '@/components/record/accent'

function operativeMotion(group: AgendaGroup) {
  return group.motions.find((m) => m.is_final && !m.is_superseded)
    ?? group.motions.find((m) => !m.is_superseded)
    ?? group.motions[0]
}

function isContested(motion: MotionTimelineItem) {
  return motion.outcome === 'failed' || (motion.vote_no ?? 0) > 0 || (motion.vote_abstain ?? 0) > 0
}

/** Up to `limit` agenda items, favoring failed and split votes, shown in agenda order. */
function pickHighlights(motions: MotionTimelineItem[], limit: number) {
  const groups = groupMotionsByAgendaItem(motions).map((group, index) => ({
    group,
    index,
    motion: operativeMotion(group),
  }))
  const contested = groups.filter((g) => isContested(g.motion))
  const rest = groups.filter((g) => !isContested(g.motion))
  return [...contested, ...rest].slice(0, limit).sort((a, b) => a.index - b.index)
}

export function HomeHero({
  districtId,
  latest,
  latestMotions,
  waveIntoTeal = false,
}: {
  districtId: SchoolDistrictId
  latest: MeetingWithSummary | null
  latestMotions: MotionTimelineItem[]
  /** Close the hero with the teal wave that opens the Recent meetings band. */
  waveIntoTeal?: boolean
}) {
  const district = getSchoolDistrict(districtId)
  const highlights = pickHighlights(latestMotions, 4)
  const operativeCount = latestMotions.filter((m) => !m.is_superseded).length

  return (
    <section className={cn('relative isolate overflow-hidden', !waveIntoTeal && 'border-b border-border')}>
      {/* Meeting-room photo behind the hero; scrim keeps text legible in both themes */}
      <Image
        src="/hero-bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 scale-[1.03] object-cover object-center blur-[2px]"
      />
      <div
        className="absolute inset-0 -z-10 bg-background/85 lg:bg-transparent lg:bg-linear-to-r lg:from-background lg:from-35% lg:via-background/80 lg:to-background/30"
        aria-hidden="true"
      />
      <div
        className={cn(
          'mx-auto grid max-w-[1200px] gap-12 px-5 pt-14 md:px-6 md:pt-20 lg:grid-cols-[5fr_7fr] lg:gap-16',
          waveIntoTeal ? 'pb-24 md:pb-36 lg:pb-40' : 'pb-14 md:pb-20'
        )}
      >
        <div className="flex flex-col justify-center">
          <p className="docket">{district.schoolSystemLabel} · School Board</p>
          <h1 className="mt-5 text-[clamp(2.5rem,5.5vw,4rem)] font-extrabold leading-[1.0] tracking-[-0.035em] text-foreground">
            School board meetings, read{' '}
            <span className="relative inline-block">
              in minutes.
              <span className="hero-underline absolute bottom-1 left-0 right-0 h-[3px] rounded-full bg-amber" aria-hidden="true" />
            </span>
          </h1>
          <p className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-foreground/75">
            Civic Cycle reads every board agenda and BoardDocs motion record, then shows you how
            each vote went with a plain-English summary. Free, no account needed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={latest ? `/meetings/${latest.id}` : '/meetings'}
              className={`inline-flex items-center gap-2 rounded-md px-5 py-3 text-[15px] font-semibold transition-colors ${AMBER_CTA}`}
            >
              Read the latest meeting
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/meetings"
              className="inline-flex items-center rounded-md border border-foreground/25 px-5 py-3 text-[15px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Browse all meetings
            </Link>
          </div>
          <div className="mt-6">
            <ViewingDistrict districtId={districtId} />
          </div>
        </div>

        {latest && (
          <div className="min-w-0 self-center rounded-md border border-border bg-card">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <p className="docket">
                Latest · {latest.body} · {(() => {
                  const d = docketDate(latest.meeting_date)
                  return `${d.weekday} ${d.month} ${d.day} ${d.year}`
                })()}
              </p>
              <Link
                href={`/meetings/${latest.id}`}
                className="mt-1 block text-[22px] font-extrabold tracking-[-0.02em] text-foreground hover:text-primary"
              >
                {latest.title}
              </Link>
            </div>

            {highlights.length > 0 ? (
              <ol>
                {highlights.map(({ group, motion }) => (
                  <li key={`${group.order}-${motion.id}`} className="border-b border-border last:border-b-0">
                    <Link
                      href={`/meetings/${latest.id}#${agendaAnchor(group.order)}`}
                      className="grid grid-cols-[3rem_1fr] gap-x-3 gap-y-2 px-5 py-4 transition-colors hover:bg-secondary/50 sm:grid-cols-[3.5rem_1fr_auto] sm:px-6"
                    >
                      <span className="item-num pt-0.5 text-[13px]">{group.order || '—'}</span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-foreground">
                          {group.title}
                        </p>
                        <VoteSeats
                          yes={motion.vote_yes}
                          no={motion.vote_no}
                          abstain={motion.vote_abstain}
                          className="mt-2"
                        />
                      </div>
                      <div className="col-start-2 sm:col-start-auto sm:pt-0.5">
                        <OutcomeStamp
                          outcome={motion.outcome}
                          yes={motion.vote_yes}
                          no={motion.vote_no}
                          abstain={motion.vote_abstain}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : latest.summary ? (
              <p className="px-5 py-5 text-[15px] leading-relaxed text-foreground/80 sm:px-6">
                {summaryExcerpt(latest.summary.summary_text)}
              </p>
            ) : null}

            <div className="border-t border-border px-5 py-3 sm:px-6">
              <Link
                href={`/meetings/${latest.id}`}
                className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary hover:underline"
              >
                {operativeCount > 0 ? `See all ${operativeCount} motions` : 'Read the summary'}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </div>
      {waveIntoTeal && (
        <WaveDivider className="absolute inset-x-0 -bottom-0.5 fill-teal-primary" />
      )}
    </section>
  )
}

export function RecentMeetingsLedger({
  meetings,
  digests,
}: {
  meetings: MeetingWithSummary[]
  digests: Record<string, MeetingMotionDigest>
}) {
  if (meetings.length === 0) return null

  return (
    <>
      {/* Teal band opened by the hero's wave; .on-teal retints the ledger's text and votes */}
      <section className="on-teal relative bg-teal-primary text-foreground">
        <div className="mx-auto max-w-[1200px] px-5 pt-6 pb-24 md:px-6 md:pt-8 md:pb-36 lg:pb-40">
          <div className="flex items-end justify-between gap-4 border-b-2 border-rule pb-3">
            <h2 className="text-[26px] font-extrabold tracking-[-0.02em] text-foreground">Recent meetings</h2>
            <Link
              href="/meetings"
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline"
            >
              All meetings <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div>
            {meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} digest={digests[meeting.id]} />
            ))}
          </div>
        </div>
        {/* Closing wave, filled with the How it works band's color so they join seamlessly */}
        <WaveDivider
          flip
          className="absolute inset-x-0 -bottom-0.5 fill-(--home-band-after)"
        />
      </section>
    </>
  )
}

const FALLBACK_DEMO: HowItWorksDemo = {
  meetingLabel: 'Regular Meeting · Oct 8, 2026',
  itemOrder: '4.01',
  rawTitle: "4.01 SUPERINTENDENT'S RECOMMENDATION FOR PREK/K TECH DEVICE USE (PRESENTATION & VOTE)",
  cleanTitle: "Superintendent's Recommendation for PREK/K Tech Device Use (Presentation & Vote)",
  motionText: "That the School Board approve the Superintendent's recommendation.",
  mover: 'Sandy B Anderson',
  yes: 8,
  no: 4,
  abstain: 0,
  outcome: 'passed',
  alerts: [
    { keyword: 'Lexia', meeting: 'Regular Meeting · Oct 8, 2026', example: true },
    { keyword: 'synthetic turf', meeting: 'Regular Meeting · Oct 8, 2026', example: true },
    { keyword: 'Whitman Middle School', meeting: 'Regular Meeting · Oct 8, 2026', example: true },
  ],
}

function meetingLabel(meeting: MeetingWithSummary) {
  return `${meeting.title} · ${formatShortDate(meeting.meeting_date)}`
}

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/**
 * Real data for the "How it works" demo: the latest meeting's most contested recorded
 * vote, and alert examples built from topics the board actually discussed recently.
 */
export function buildHowItWorksDemo(
  latest: MeetingWithSummary | null,
  latestMotions: MotionTimelineItem[],
  recent: MeetingWithSummary[]
): HowItWorksDemo {
  if (!latest) return FALLBACK_DEMO

  const pick = pickHighlights(latestMotions, 4)
    .map((h) => h.motion)
    .find((m) => m.vote_yes !== null && (m.vote_no ?? 0) > 0 && (m.vote_yes ?? 0) + (m.vote_no ?? 0) <= 15)

  const alerts = [latest, ...recent]
    .flatMap((meeting) => meeting.approvedTopics.slice(0, 1).map((topic) => ({
      keyword: topic.display_name,
      meeting: meetingLabel(meeting),
      example: false,
    })))
    .slice(0, 3)

  if (!pick) {
    return { ...FALLBACK_DEMO, alerts: alerts.length >= 3 ? alerts : FALLBACK_DEMO.alerts }
  }

  return {
    meetingLabel: meetingLabel(latest),
    itemOrder: pick.agenda_item_order,
    rawTitle: pick.agenda_item_title,
    cleanTitle: cleanAgendaTitle(pick.agenda_item_title, pick.agenda_item_order),
    motionText: pick.normalized_motion_text,
    mover: pick.mover,
    yes: pick.vote_yes ?? 0,
    no: pick.vote_no ?? 0,
    abstain: pick.vote_abstain ?? 0,
    outcome: pick.outcome,
    alerts: alerts.length >= 3 ? alerts : FALLBACK_DEMO.alerts,
  }
}

export function AlertsCta() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-16 md:px-6 md:py-20">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="docket">Keyword alerts</p>
          <h2 className="mt-3 max-w-[22ch] text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.08] tracking-[-0.025em] text-foreground">
            Hear about it when your school comes up.
          </h2>
        </div>
        <Link
          href="/auth/signup"
          className={`inline-flex shrink-0 items-center gap-2 self-start rounded-md px-5 py-3 text-[15px] font-semibold transition-colors ${AMBER_CTA} md:self-auto`}
        >
          Create a free account
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
