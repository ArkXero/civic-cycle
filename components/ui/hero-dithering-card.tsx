'use client'

import { ArrowRight, Zap } from 'lucide-react'
import { useState, Suspense, lazy } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

const Dithering = lazy(() =>
  import('@paper-design/shaders-react').then((mod) => ({ default: mod.Dithering }))
)

const easing = [0.22, 1, 0.36, 1] as [number, number, number, number]

export function DitheringHero() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <section className="py-8 w-full flex justify-center items-center px-4 md:px-6">
      <div
        className="w-full max-w-7xl relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: easing }}
          className="relative overflow-hidden rounded-[48px] border shadow-lg min-h-[600px] md:min-h-[680px] flex flex-col items-center justify-center"
          style={{
            background: '#020C10',
            borderColor: 'rgba(26, 138, 154, 0.2)',
          }}
        >
          {/* Dithering shader background */}
          <Suspense fallback={<div className="absolute inset-0" style={{ background: '#020C10' }} />}>
            <div
              className="absolute inset-0 z-0 pointer-events-none"
              style={{
                opacity: 0.55,
                mixBlendMode: 'screen',
              }}
            >
              <Dithering
                colorBack="#00000000"
                colorFront="#0D5E6B"
                shape="warp"
                type="4x4"
                speed={isHovered ? 0.6 : 0.2}
                className="size-full"
                minPixelRatio={1}
              />
            </div>
          </Suspense>

          {/* Content */}
          <div className="relative z-10 px-6 max-w-4xl mx-auto text-center flex flex-col items-center">

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: easing }}
              style={{
                fontFamily: 'var(--font-display-var), Georgia, serif',
                fontWeight: 400,
                fontSize: 'clamp(3.5rem, 9vw, 8rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: '#F4F8F9',
              }}
            >
              Fairfax County,
              <br />
              <span style={{ color: 'rgba(244,248,249,0.65)', fontStyle: 'italic' }}>
                Made Clear.
              </span>
            </motion.h1>

            {/* Animated underline */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, delay: 0.55, ease: easing }}
              className="origin-left mt-2 h-[2px] rounded-full"
              style={{
                width: '10rem',
                background: '#F5A623',
              }}
            />

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: easing }}
              className="mt-8 text-lg md:text-xl leading-relaxed max-w-2xl"
              style={{
                color: 'rgba(244,248,249,0.60)',
                fontFamily: 'var(--font-body-var), monospace',
              }}
            >
              Every School Board meeting, automatically summarized — key decisions,
              budget items, and policy changes surfaced for residents who
              don&apos;t have three hours.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35, ease: easing }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              {/* Primary */}
              <Link
                href="/meetings"
                className="group inline-flex h-14 items-center justify-center gap-3 rounded-full px-12 text-base font-medium transition-all duration-300 hover:scale-105 active:scale-95"
                style={{
                  background: '#1A8A9A',
                  color: '#F4F8F9',
                  fontFamily: 'var(--font-body-var), monospace',
                  boxShadow: '0 4px 24px rgba(26,138,154,0.4)',
                }}
              >
                Read Latest Summary
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              {/* Secondary */}
              <Link
                href="/meetings"
                className="inline-flex h-14 items-center justify-center gap-3 rounded-full px-10 text-base font-medium transition-all duration-300 hover:scale-105 active:scale-95"
                style={{
                  background: 'rgba(26,138,154,0.12)',
                  border: '1px solid rgba(26,138,154,0.35)',
                  color: '#F4F8F9',
                  fontFamily: 'var(--font-body-var), monospace',
                }}
              >
                View All Meetings
                <Zap className="h-4 w-4" style={{ color: '#F5A623' }} />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
