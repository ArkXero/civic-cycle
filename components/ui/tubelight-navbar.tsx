'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Home, FileText, Bell, Upload, LogIn, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME, NAV_LINKS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface NavItem {
  name: string
  url: string
  icon: React.ReactNode
  action?: () => Promise<void>
  visible?: (user: User | null) => boolean
}

const iconMap: Record<string, React.ReactNode> = {
  Home: <Home size={18} strokeWidth={2.5} />,
  Meetings: <FileText size={18} strokeWidth={2.5} />,
  'My Alerts': <Bell size={18} strokeWidth={2.5} />,
  Import: <Upload size={18} strokeWidth={2.5} />,
}

export function TubelightNavbar() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  // Build nav items from NAV_LINKS + auth items
  const navItems: NavItem[] = NAV_LINKS.filter(link => !link.protected || user).map(link => ({
    name: link.label,
    url: link.href,
    icon: iconMap[link.label] || <Home size={18} strokeWidth={2.5} />,
  }))

  // Add sign in/out
  if (!user) {
    navItems.push({
      name: 'Sign In',
      url: '/auth/login',
      icon: <LogIn size={18} strokeWidth={2.5} />,
    })
  } else {
    navItems.push({
      name: 'Sign Out',
      url: '#',
      icon: <LogOut size={18} strokeWidth={2.5} />,
      action: handleSignOut,
    })
  }

  const handleNavClick = async (item: NavItem) => {
    if (item.action) {
      await item.action()
    }
  }

  return (
    <>
      {/* Logo - fixed top-left */}
      <div className="fixed top-4 left-6 z-50 md:top-6 md:left-6 flex items-center gap-2">
        <div className="flex gap-0.5" aria-hidden="true">
          <div
            className="w-2 h-5 rounded-sm"
            style={{ background: '#1A8A9A' }}
          />
          <div
            className="w-2 h-5 rounded-sm"
            style={{ background: '#F5A623' }}
          />
        </div>
        <span
          className="text-sm md:text-lg text-white"
          style={{ fontFamily: 'var(--font-display-var), Georgia, serif', fontWeight: 400 }}
        >
          {APP_NAME}
        </span>
      </div>

      {/* Tubelight Navbar Pill */}
      <div
        className={cn(
          'fixed left-1/2 -translate-x-1/2 z-40 mb-6 sm:pt-6',
          isMobile ? 'bottom-0' : 'top-0'
        )}
      >
        <div className="flex items-center gap-3 backdrop-blur-lg py-1 px-1 rounded-full shadow-lg"
          style={{
            background: 'rgba(13, 94, 107, 0.15)',
            border: '1px solid rgba(26, 138, 154, 0.25)',
          }}
        >
          {navItems.map((item) => {
            const isActive = pathname === item.url && item.url !== '#'

            if (item.action) {
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    'relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors',
                    'text-white/80 hover:text-white',
                    isActive && 'text-white'
                  )}
                >
                  <span className="hidden md:inline">{item.name}</span>
                  <span className="md:hidden flex items-center justify-center">
                    {item.icon}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="lamp"
                      className="absolute inset-0 w-full rounded-full -z-10"
                      initial={false}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                      }}
                      style={{ background: 'rgba(26,138,154,0.2)' }}
                    >
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-t-full" style={{ background: '#1A8A9A' }}>
                        <div className="absolute w-12 h-6 rounded-full blur-md -top-2 -left-2" style={{ background: 'rgba(26,138,154,0.2)' }} />
                        <div className="absolute w-8 h-6 rounded-full blur-md -top-1" style={{ background: 'rgba(26,138,154,0.2)' }} />
                        <div className="absolute w-4 h-4 rounded-full blur-sm top-0 left-2" style={{ background: 'rgba(26,138,154,0.2)' }} />
                      </div>
                    </motion.div>
                  )}
                </button>
              )
            }

            return (
              <Link
                key={item.name}
                href={item.url}
                className={cn(
                  'relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors',
                  'text-white/80 hover:text-white',
                  isActive && 'text-white'
                )}
              >
                <span className="hidden md:inline">{item.name}</span>
                <span className="md:hidden flex items-center justify-center">
                  {item.icon}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="lamp"
                    className="absolute inset-0 w-full rounded-full -z-10"
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 30,
                    }}
                    style={{ background: 'rgba(26,138,154,0.2)' }}
                  >
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-t-full" style={{ background: '#1A8A9A' }}>
                      <div className="absolute w-12 h-6 rounded-full blur-md -top-2 -left-2" style={{ background: 'rgba(26,138,154,0.2)' }} />
                      <div className="absolute w-8 h-6 rounded-full blur-md -top-1" style={{ background: 'rgba(26,138,154,0.2)' }} />
                      <div className="absolute w-4 h-4 rounded-full blur-sm top-0 left-2" style={{ background: 'rgba(26,138,154,0.2)' }} />
                    </div>
                  </motion.div>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
