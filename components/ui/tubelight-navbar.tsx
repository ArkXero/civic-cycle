'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Home, FileText, Bell, Upload, LayoutDashboard, LogIn, LogOut, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { APP_NAME, NAV_LINKS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { isAdminJwt } from '@/lib/auth/get-role'
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
  Dashboard: <LayoutDashboard size={18} strokeWidth={2.5} />,
}

export function TubelightNavbar() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [supabase] = useState(() => createClient())
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data: { session } } = await supabase.auth.getSession()
      setIsAdmin(session ? isAdminJwt(session.access_token) : false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsAdmin(session ? isAdminJwt(session.access_token) : false)
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

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  // Build nav items from NAV_LINKS + auth items
  const navItems: NavItem[] = NAV_LINKS.filter(link => (!link.protected || user) && (!link.adminOnly || isAdmin)).map(link => ({
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-1 backdrop-blur-lg py-2 px-4 rounded-full shadow-lg bg-card border border-border">
        {/* Nav items */}
        {navItems.map((item) => {
          const isActive = pathname === item.url && item.url !== '#'

          if (item.action) {
            return (
              <button
                key={item.name}
                onClick={() => handleNavClick(item)}
                className={cn(
                  'relative cursor-pointer text-sm font-semibold px-4 py-2 rounded-full transition-colors flex-shrink-0',
                  'text-foreground/70 hover:text-foreground',
                  isActive && 'text-foreground'
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
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-t-full" style={{ background: '#f3a623' }}>
                      <div className="absolute w-12 h-6 rounded-full blur-md -top-2 -left-2" style={{ background: 'rgba(243,166,35,0.25)' }} />
                      <div className="absolute w-8 h-6 rounded-full blur-md -top-1" style={{ background: 'rgba(243,166,35,0.25)' }} />
                      <div className="absolute w-4 h-4 rounded-full blur-sm top-0 left-2" style={{ background: 'rgba(243,166,35,0.25)' }} />
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
                'relative cursor-pointer text-sm font-semibold px-4 py-2 rounded-full transition-colors flex-shrink-0',
                'text-foreground/70 hover:text-foreground',
                isActive && 'text-foreground'
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

        {/* Divider */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="cursor-pointer p-2 rounded-full transition-colors text-foreground/70 hover:text-foreground hover:bg-muted"
          aria-label="Toggle theme"
        >
          {mounted && theme === 'dark' ? (
            <Sun size={18} strokeWidth={2.5} />
          ) : (
            <Moon size={18} strokeWidth={2.5} />
          )}
        </button>
      </div>
    </div>
  )
}
