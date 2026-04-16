'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { MeetingCard } from '@/components/meetings/meeting-card'
import type { MeetingWithSummary } from '@/types'

const easing = [0.22, 1, 0.36, 1] as [number, number, number, number]

export function RecentMeetingsSection({ meetings }: { meetings: MeetingWithSummary[] }) {
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
            <p className="text-xs font-bold tracking-[0.2em] mb-2 text-amber font-body">
              RECENT ACTIVITY
            </p>
            <h2 className="text-foreground">Recent Meeting Summaries</h2>
          </div>
          <Link
            href="/meetings"
            className="hidden sm:flex items-center gap-2 text-sm font-medium transition-colors text-foreground/75 font-body"
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
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground/75 font-body"
          >
            View all meetings <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

export function HomeCtaSection() {
  return (
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
          <p className="text-lg mb-10 text-foreground/75 font-body">
            Browse recent meeting summaries or create a free account to set up
            personalized keyword alerts.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/meetings"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium transition-all hover:scale-105 active:scale-95 bg-teal-dark text-off-white font-body"
            >
              View Recent Meetings
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium transition-all hover:scale-105 active:scale-95 border border-border text-foreground font-body"
            >
              Create Free Account
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
