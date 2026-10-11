'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useInView, useReducedMotion } from 'motion/react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TransitionPanel } from '@/components/motion-primitives/transition-panel'
import { TextScramble } from '@/components/motion-primitives/text-scramble'
import { RollingNumber } from '@/components/ui/rolling-number'
import { AnimatedList } from '@/components/ui/animated-list'
import { OutcomeStamp } from '@/components/record/vote-seats'
import type { MotionOutcome } from '@/types'

export interface HowItWorksDemo {
  meetingLabel: string
  itemOrder: string
  rawTitle: string
  cleanTitle: string
  motionText: string
  mover: string | null
  yes: number
  no: number
  abstain: number
  outcome: MotionOutcome
  alerts: { keyword: string; meeting: string; example: boolean }[]
}

const STEPS = [
  {
    order: '1.01',
    title: 'The board publishes its record',
    body: 'Agendas, attachments, and post-meeting motion results go up on BoardDocs, usually within days.',
    duration: 4500,
    durationClass: '[animation-duration:4500ms]',
  },
  {
    order: '1.02',
    title: 'We read all of it',
    body: 'Civic Cycle pulls each motion, its exact wording, who moved it, and the vote. Claude writes the summary.',
    duration: 6500,
    durationClass: '[animation-duration:6500ms]',
  },
  {
    order: '1.03',
    title: 'You read two minutes, not three hours',
    body: 'Browse the record here, or get an email when a keyword like your school or "bell schedule" comes up.',
    duration: 6000,
    durationClass: '[animation-duration:6000ms]',
  },
]

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
// Literal classes so Tailwind can see them; one step per seat (boards seat up to 12 + student rep).
const SEAT_DELAYS = [
  'delay-[0ms]', 'delay-[90ms]', 'delay-[180ms]', 'delay-[270ms]', 'delay-[360ms]',
  'delay-[450ms]', 'delay-[540ms]', 'delay-[630ms]', 'delay-[720ms]', 'delay-[810ms]',
  'delay-[900ms]', 'delay-[990ms]', 'delay-[1080ms]', 'delay-[1170ms]', 'delay-[1260ms]',
]

/* ── Step demos ─────────────────────────────────────────────────────────── */

function PublishDemo({ demo }: { demo: HowItWorksDemo }) {
  return (
    <div className="space-y-4">
      <p className="docket">Source · BoardDocs · {demo.meetingLabel}</p>
      <div className="space-y-3 rounded-md border border-border bg-background p-4 font-mono text-[12.5px] leading-relaxed text-muted-foreground">
        <p className="text-foreground/90">{demo.rawTitle.toUpperCase()}</p>
        <p>MOTION: {demo.motionText}</p>
        {demo.mover && <p>MOVED BY: {demo.mover.toUpperCase()}</p>}
        <p>
          VOTE: YES {demo.yes} · NO {demo.no}
          {demo.abstain > 0 && ` · ABSTAIN ${demo.abstain}`}
        </p>
      </div>
    </div>
  )
}

function Seats({ yes, no, abstain, lit }: { yes: number; no: number; abstain: number; lit: boolean }) {
  const seats = [
    ...Array<string>(yes).fill('yes'),
    ...Array<string>(no).fill('no'),
    ...Array<string>(abstain).fill('abstain'),
  ]
  return (
    <div className="flex flex-wrap gap-[3px]" aria-hidden="true">
      {seats.map((kind, index) => (
        <span
          key={index}
          className={cn(
            'h-[13px] w-[13px] rounded-[2px] transition-colors duration-150',
            lit && SEAT_DELAYS[Math.min(index, SEAT_DELAYS.length - 1)],
            !lit && 'bg-muted',
            lit && kind === 'yes' && 'bg-primary',
            lit && kind === 'no' && 'bg-destructive',
            lit && kind === 'abstain' && 'bg-muted-foreground/35'
          )}
        />
      ))}
    </div>
  )
}

function Tally({ label, value, start, reduced, onDone, className }: {
  label: string
  value: number
  start: boolean
  reduced: boolean
  onDone?: () => void
  className?: string
}) {
  return (
    <div>
      <p className="docket">{label}</p>
      <p className={cn('mt-1 font-mono text-[34px] font-semibold leading-none tabular-nums', className)}>
        {/* Critically damped (no overshoot): an 8 never flashes 9 on the way in. */}
        <RollingNumber
          value={start || reduced ? value : 0}
          mass={0.8}
          stiffness={70}
          damping={16}
          onAnimationComplete={onDone}
        />
      </p>
    </div>
  )
}

function ReadDemo({ demo, reduced }: { demo: HowItWorksDemo; reduced: boolean }) {
  const [counting, setCounting] = useState(reduced)
  const [settled, setSettled] = useState(reduced)

  return (
    <div className="space-y-5">
      <div>
        <p className="docket">Agenda item <span className="item-num">{demo.itemOrder}</span></p>
        <p className="mt-2 truncate font-mono text-[12px] text-muted-foreground line-through decoration-muted-foreground/40">
          {demo.rawTitle.toUpperCase()}
        </p>
        <TextScramble
          as="p"
          className="mt-1 text-[19px] font-bold leading-snug text-foreground"
          characterSet={UPPERCASE}
          duration={0.9}
          trigger={!reduced}
          onScrambleComplete={() => setCounting(true)}
        >
          {demo.cleanTitle}
        </TextScramble>
      </div>

      <Seats yes={demo.yes} no={demo.no} abstain={demo.abstain} lit={counting} />

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <Tally label="Yes" value={demo.yes} start={counting} reduced={reduced} className="text-primary" />
        <Tally label="No" value={demo.no} start={counting} reduced={reduced} className="text-destructive"
          onDone={() => setSettled(true)} />
        {demo.abstain > 0 && (
          <Tally label="Abstain" value={demo.abstain} start={counting} reduced={reduced} className="text-muted-foreground" />
        )}
        <div
          className={cn(
            'ml-auto transition-[opacity,transform] duration-300 ease-out',
            settled ? 'scale-100 opacity-100' : 'scale-110 opacity-0'
          )}
        >
          <OutcomeStamp outcome={demo.outcome} yes={demo.yes} no={demo.no} abstain={demo.abstain} />
        </div>
      </div>
      <p className="sr-only">
        {demo.cleanTitle}: {demo.yes} yes, {demo.no} no{demo.abstain > 0 ? `, ${demo.abstain} abstain` : ''}.
      </p>
    </div>
  )
}

function AlertCard({ alert }: { alert: HowItWorksDemo['alerts'][number] }) {
  return (
    <div className="flex w-full items-start gap-3 rounded-md border border-border bg-background px-4 py-3">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-amber-dark dark:text-accent">
        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-foreground">
          &ldquo;{alert.keyword}&rdquo; came up
        </p>
        <p className="truncate text-[13px] text-muted-foreground">{alert.meeting}</p>
      </div>
      <span className="docket ml-auto shrink-0 pt-0.5">{alert.example ? 'Example' : 'Email'}</span>
    </div>
  )
}

function AlertDemo({ demo, reduced }: { demo: HowItWorksDemo; reduced: boolean }) {
  return (
    <div className="space-y-4">
      <p className="docket">Your inbox · keyword alerts</p>
      {reduced ? (
        <div className="space-y-3">
          {demo.alerts.map((alert) => <AlertCard key={alert.keyword + alert.meeting} alert={alert} />)}
        </div>
      ) : (
        <AnimatedList delay={1100} className="gap-3">
          {demo.alerts.map((alert) => <AlertCard key={alert.keyword + alert.meeting} alert={alert} />)}
        </AnimatedList>
      )}
    </div>
  )
}

/* ── Stepper ────────────────────────────────────────────────────────────── */

export function HowItWorks({ demo }: { demo: HowItWorksDemo }) {
  const reduced = useReducedMotion() ?? false
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { amount: 0.4 })
  const [active, setActive] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const [paused, setPaused] = useState(false)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const playing = autoplay && !paused && inView && !reduced

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setActive((i) => (i + 1) % STEPS.length), STEPS[active].duration)
    return () => clearTimeout(timer)
  }, [playing, active])

  // Choosing a step takes over from autoplay.
  const select = useCallback((index: number) => {
    setAutoplay(false)
    setActive(index)
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    if (!(event.key in keys)) return
    event.preventDefault()
    const next = (active + keys[event.key] + STEPS.length) % STEPS.length
    select(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section ref={sectionRef} className="border-b border-border bg-secondary/40">
      <div className="mx-auto max-w-[1200px] px-5 py-16 md:px-6 md:py-20">
        <div className="border-b-2 border-rule pb-3">
          <h2 className="text-[26px] font-extrabold tracking-[-0.02em] text-foreground">How it works</h2>
        </div>

        <div
          className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div role="tablist" aria-label="How Civic Cycle works" aria-orientation="vertical" onKeyDown={onKeyDown}>
            {STEPS.map((step, index) => {
              const isActive = index === active
              return (
                <button
                  key={step.order}
                  ref={(el) => { tabRefs.current[index] = el }}
                  role="tab"
                  id={`how-tab-${index}`}
                  aria-selected={isActive}
                  aria-controls="how-panel"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => select(index)}
                  className={cn(
                    'relative grid w-full grid-cols-[3.5rem_1fr] gap-x-3 border-b border-border py-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    !isActive && 'opacity-60 hover:opacity-100'
                  )}
                >
                  <span className="item-num pt-0.5 text-[14px]">{step.order}</span>
                  <span>
                    <span className="block text-[18px] font-bold leading-snug text-foreground">{step.title}</span>
                    <span className="mt-1.5 block max-w-[42ch] text-[15px] leading-relaxed text-muted-foreground">
                      {step.body}
                    </span>
                  </span>
                  {/* Progress rule: fills while this step is on screen during autoplay */}
                  {isActive && (
                    <span
                      key={`${active}-${playing}`}
                      aria-hidden="true"
                      className={cn(
                        'absolute -bottom-px left-0 h-[2px] w-full origin-left bg-primary',
                        playing && ['how-progress', step.durationClass]
                      )}
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div
            id="how-panel"
            role="tabpanel"
            aria-labelledby={`how-tab-${active}`}
            className="flex min-h-[300px] flex-col justify-center rounded-md border border-border bg-card p-5 sm:p-6"
          >
            <TransitionPanel
              activeIndex={active}
              transition={reduced ? { duration: 0.15 } : { type: 'spring', bounce: 0, duration: 0.4 }}
              variants={{
                enter: { opacity: 0, y: reduced ? 0 : 12 },
                center: { opacity: 1, y: 0 },
                exit: { opacity: 0, y: reduced ? 0 : -12 },
              }}
            >
              {[
                <PublishDemo key="publish" demo={demo} />,
                <ReadDemo key="read" demo={demo} reduced={reduced} />,
                <AlertDemo key="alerts" demo={demo} reduced={reduced} />,
              ]}
            </TransitionPanel>
          </div>
        </div>
      </div>
    </section>
  )
}
