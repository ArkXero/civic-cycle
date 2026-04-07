'use client'

import Link from 'next/link'
import { ArrowRight, Brain, Search, Bell, CircuitBoard } from 'lucide-react'
import { motion } from 'framer-motion'
import { MeetingCard } from '@/components/meetings/meeting-card'
import { DitheringHero } from '@/components/ui/hero-dithering-card'

import { ContainerTextFlip } from '@/components/ui/container-text-flip'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { MeetingWithSummary } from '@/types'

const easing = [0.22, 1, 0.36, 1] as [number, number, number, number]

function RecentMeetings() {
  const [meetings, setMeetings] = useState<MeetingWithSummary[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('meetings')
      .select('*, summary:summaries(*)')
      .eq('status', 'summarized')
      .order('meeting_date', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) {
          setMeetings(
            data.map((m) => {
              const meeting = m as { summary?: unknown[] }
              return Object.assign({}, m, { summary: meeting.summary?.[0] || null })
            }) as MeetingWithSummary[]
          )
        }
      })
  }, [])

  if (meetings.length === 0) return null

  return (
    <section className="py-24 bg-background">
      <div className="max-w-[1200px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: easing }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <p
              className="text-xs font-bold tracking-[0.2em] mb-2"
              style={{ color: '#F5A623', fontFamily: 'var(--font-body-var), monospace' }}
            >
              RECENT ACTIVITY
            </p>
            <h2 className="text-foreground">
              Recent Meeting Summaries
            </h2>
          </div>
          <Link
            href="/meetings"
            className="hidden sm:flex items-center gap-2 text-sm font-medium transition-colors text-foreground/75"
            style={{ fontFamily: 'var(--font-body-var), monospace' }}
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.map((meeting, i) => (
            <motion.div
              key={meeting.id}
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.15, ease: easing }}
            >
              <MeetingCard meeting={meeting} />
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/meetings"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground/75"
            style={{ fontFamily: 'var(--font-body-var), monospace' }}
          >
            View all meetings <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <div className="bg-background">
      {/* ── Hero (dithering shader) ── */}
      <DitheringHero />

      {/* ── Recent Meetings ── */}
      <RecentMeetings />

      {/* ── How It Works ── */}
      <section className="py-24 bg-background">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: easing }}
            className="text-center mb-14"
          >
            <p
              className="text-xs font-bold tracking-[0.2em] mb-3"
              style={{ color: '#F5A623', fontFamily: 'var(--font-body-var), monospace' }}
            >
              HOW IT WORKS
            </p>
            <h2
              className="text-4xl md:text-5xl text-foreground"
              style={{ maxWidth: '700px', margin: '0 auto' }}
            >
              Public infrastructure deserves public clarity.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* ── Card 1: AI-Powered Summaries ── */}
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0, ease: easing }}
              className="relative overflow-hidden glass-card rounded-xl p-8 transition-all duration-200 hover:-translate-y-0.5"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(43,189,212,0.5)'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(26,138,154,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(26,138,154,0.25)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {/* Decorative chip — top-right, intentionally partially out of frame */}
              <CircuitBoard
                className="absolute -top-5 -right-5 opacity-[0.09] pointer-events-none"
                style={{ width: 130, height: 130, color: '#2BBDD4' }}
                strokeWidth={1}
                aria-hidden="true"
              />
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-6"
                style={{ background: 'rgba(26,138,154,0.15)' }}
              >
                <Brain className="h-6 w-6" style={{ color: '#2BBDD4' }} />
              </div>
              <h3 className="text-xl mb-3 text-foreground">AI-Powered Summaries</h3>
              <p
                className="text-sm leading-relaxed text-muted-foreground"
                style={{ fontFamily: 'var(--font-body-var), monospace' }}
              >
                We use Claude AI to analyze meeting agendas and extract key decisions, votes, and action items — so you can read a 2-minute summary instead of a 3-hour agenda.
              </p>
            </motion.div>

            {/* ── Card 2: Search & Filter ── */}
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15, ease: easing }}
              className="glass-card rounded-xl p-8 transition-all duration-200 hover:-translate-y-0.5"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(43,189,212,0.5)'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(26,138,154,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(26,138,154,0.25)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-6"
                style={{ background: 'rgba(26,138,154,0.15)' }}
              >
                <Search className="h-6 w-6" style={{ color: '#2BBDD4' }} />
              </div>
              <h3 className="text-xl mb-3 text-foreground">Search & Filter</h3>
              <p
                className="text-sm leading-relaxed text-muted-foreground"
                style={{ fontFamily: 'var(--font-body-var), monospace' }}
              >
                Find discussions about topics you care about across all past meetings. Search for &ldquo;bell schedules&rdquo;, &ldquo;budget&rdquo;, or any topic and filter by date or meeting type.
              </p>
            </motion.div>

            {/* ── Card 3: Keyword Alerts ── */}
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.3, ease: easing }}
              className="glass-card rounded-xl p-8 transition-all duration-200 hover:-translate-y-0.5"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(43,189,212,0.5)'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(26,138,154,0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(26,138,154,0.25)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-12 h-12 flex-shrink-0 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(26,138,154,0.15)' }}
                >
                  <Bell className="h-6 w-6" style={{ color: '#2BBDD4' }} />
                </div>
                <ContainerTextFlip
                  words={["taxes", "zoning", "curriculum", "budget", "transportation", "redistricting", "hiring", "athletics"]}
                  interval={2500}
                />
              </div>
              <h3 className="text-xl mb-3 text-foreground">Keyword Alerts</h3>
              <p
                className="text-sm leading-relaxed text-muted-foreground"
                style={{ fontFamily: 'var(--font-body-var), monospace' }}
              >
                Set up alerts for keywords like your school name, &ldquo;property tax&rdquo;, or &ldquo;transportation&rdquo;. We&apos;ll email you when there&apos;s a match in a new meeting summary.
              </p>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-24 bg-background">
        <div className="max-w-[900px] mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: easing }}
          >
            <h2 className="text-4xl md:text-5xl mb-4 text-foreground">
              Ready to Stay Informed?
            </h2>
            <p
              className="text-lg mb-10 text-foreground/75"
              style={{ fontFamily: 'var(--font-body-var), monospace' }}
            >
              Browse recent meeting summaries or create a free account to set up
              personalized keyword alerts.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/meetings"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium transition-all hover:scale-105 active:scale-95"
                style={{
                  background: '#0D5E6B',
                  color: '#F4F8F9',
                  fontFamily: 'var(--font-body-var), monospace',
                }}
              >
                View Recent Meetings
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium transition-all hover:scale-105 active:scale-95 border border-border text-foreground"
                style={{ fontFamily: 'var(--font-body-var), monospace' }}
              >
                Create Free Account
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
