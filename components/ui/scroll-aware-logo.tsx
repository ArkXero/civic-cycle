'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { APP_NAME } from '@/lib/constants'

export function ScrollAwareLogo() {
  const [scrollY, setScrollY] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Determine if scrolling up or down
      const isScrollingDown = currentScrollY > lastScrollY

      // Hide when scrolling down, show when scrolling up
      if (isScrollingDown && currentScrollY > 100) {
        setIsVisible(false)
      } else if (!isScrollingDown) {
        setIsVisible(true)
      }

      setScrollY(currentScrollY)
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        y: isVisible ? 0 : -100,
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-30"
    >
      <Link href="/" className="flex items-center gap-2">
        <div className="flex gap-0.5" aria-hidden="true">
          <div
            className="w-2.5 h-6 rounded-sm"
            style={{ background: '#1A8A9A' }}
          />
          <div
            className="w-2.5 h-6 rounded-sm"
            style={{ background: '#F5A623' }}
          />
        </div>
        <span
          className="text-sm md:text-base text-white whitespace-nowrap"
          style={{ fontFamily: 'var(--font-display-var), Georgia, serif', fontWeight: 400 }}
        >
          {APP_NAME}
        </span>
      </Link>
    </motion.div>
  )
}
