'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Bell,
  CalendarDays,
  FileDown,
  Home,
  LayoutDashboard,
  ListTree,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  Tags,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { APP_NAME, NAV_LINKS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { isAdminJwt } from '@/lib/auth/get-role'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import type { User } from '@supabase/supabase-js'
import { ScrollProgress } from '@/components/motion-primitives/scroll-progress'
import { CommandPalette } from '@/components/layout/command-palette'
import { useMediaQuery, useNavLabelMode } from '@/hooks/use-nav-label-mode'
import { AMBER_CTA } from '@/components/record/accent'

const navIcons = {
  '/': Home,
  '/meetings': ListTree,
  '/calendar': CalendarDays,
  '/alerts': Bell,
  '/settings': Settings,
  '/admin/boarddocs': FileDown,
  '/admin/topics': Tags,
  '/admin/dashboard': LayoutDashboard,
} as const

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

// A single meeting record (/meetings/[id]) gets a reading-progress rule under the bar.
const MEETING_RECORD_PATH = /^\/meetings\/[^/]+$/

export function Header() {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const labelMode = useNavLabelMode()
  const isLg = useMediaQuery('(min-width: 1024px)')
  const isXl = useMediaQuery('(min-width: 1280px)')
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isMac, setIsMac] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [hoveredHref, setHoveredHref] = useState<string | null>(null)
  const [supabase] = useState(() => createClient())
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
    setIsMac(/mac|iphone|ipad/i.test(navigator.userAgent))
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        const { data: { session } } = await supabase.auth.getSession()
        setIsAdmin(session ? isAdminJwt(session.access_token) : false)
      } finally {
        setAuthLoading(false)
      }
    }
    void init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsAdmin(session ? isAdminJwt(session.access_token) : false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const visibleLinks = NAV_LINKS.filter(
    (link) => (!link.protected || user) && (!link.adminOnly || isAdmin)
  )
  // Signed-in readers land on their own pages, so Home drops out of the nav.
  const navLinks = user ? visibleLinks.filter((link) => link.href !== '/') : visibleLinks
  // Settings lives at the far right of the bar, apart from the section tabs.
  const tabLinks = navLinks.filter((link) => link.href !== '/settings')
  const showSettings = navLinks.some((link) => link.href === '/settings')
  const activeHref = navLinks.find((link) => isActivePath(pathname, link.href))?.href ?? null
  // The amber pill rests on the current section and follows hover/focus.
  const pillHref = hoveredHref ?? activeHref
  // "labels" mode shows every name when there's room (more tabs need a wider screen);
  // otherwise only the hovered/focused tab expands to show its name.
  const showAllLabels = labelMode === 'labels' && (tabLinks.length > 4 ? isXl : isLg)
  const tabTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, bounce: 0, duration: 0.35 }

  return (
    <>
      <header className="material-bar sticky top-0 z-50 w-full border-b border-border">
        <div className="max-w-[1200px] mx-auto flex h-16 items-center justify-between gap-4 px-6">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image
              src="/favicon.png"
              alt={APP_NAME}
              width={28}
              height={28}
              priority
              unoptimized
              className="rounded-md"
            />
            <span className="text-[17px] font-extrabold text-foreground tracking-[-0.02em]">
              {APP_NAME}
            </span>
          </Link>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-2">
            {/* Search / command palette */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background/60 pl-2.5 pr-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
              aria-label="Search meetings and pages"
              aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
            >
              <Search size={14} strokeWidth={2} aria-hidden="true" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="rounded-sm border border-border bg-secondary px-1.5 py-px font-mono text-[10.5px] text-muted-foreground">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>

            <nav
              aria-label="Main"
              className="flex items-center gap-1 rounded-xl border border-border bg-card p-1"
              onMouseLeave={() => setHoveredHref(null)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setHoveredHref(null)
                }
              }}
            >
              {tabLinks.map((link) => {
                const Icon = navIcons[link.href as keyof typeof navIcons] ?? Shield
                const isActive = link.href === activeHref
                const isExpanded = showAllLabels || link.href === hoveredHref
                const hasPill = pillHref === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    onMouseEnter={() => setHoveredHref(link.href)}
                    onFocus={() => setHoveredHref(link.href)}
                    className={cn(
                      'relative flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      hasPill
                        ? 'text-accent-foreground'
                        : showAllLabels ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {hasPill && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-lg bg-accent"
                        transition={tabTransition}
                        aria-hidden="true"
                      />
                    )}
                    <Icon size={18} strokeWidth={2} className="relative shrink-0" aria-hidden="true" />
                    {!isExpanded && <span className="sr-only">{link.label}</span>}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.span
                          key="label"
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 'auto', opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={tabTransition}
                          className="relative overflow-hidden whitespace-nowrap"
                        >
                          <span className="block pl-2 pr-1">{link.label}</span>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                )
              })}
            </nav>

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-2" />

            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-md text-muted-foreground hover:text-primary transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
              </button>
            )}

            {/* Auth */}
            {!authLoading && (user ? (
              <button
                onClick={handleSignOut}
                className="ml-1 px-3.5 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/auth/login"
                className={`ml-1 inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold transition-colors ${AMBER_CTA}`}
              >
                Sign In
              </Link>
            ))}

            {showSettings && (
              <Link
                href="/settings"
                aria-label="Settings"
                aria-current={activeHref === '/settings' ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  activeHref === '/settings'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Settings size={18} strokeWidth={2} aria-hidden="true" />
              </Link>
            )}
          </div>

          {/* Mobile header actions */}
          <div className="flex items-center gap-1.5 md:hidden">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
              aria-label="Search meetings and pages"
            >
              <Search size={16} strokeWidth={2} />
            </button>

            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
              </button>
            )}

            {!authLoading && (user ? (
              <button
                onClick={handleSignOut}
                className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card/95 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] dark:bg-popover/90"
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card/95 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] dark:bg-popover/90"
              >
                Sign In
              </Link>
            ))}
          </div>

        </div>

        {MEETING_RECORD_PATH.test(pathname) && (
          <ScrollProgress
            className="absolute top-auto -bottom-px h-0.5 bg-primary"
            springOptions={reduceMotion ? { stiffness: 1000, damping: 100 } : undefined}
          />
        )}
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} links={navLinks} />

      <nav
        className="fixed inset-x-0 bottom-0 z-50 material-bar border-t border-border px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-md items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-card/95 p-1.5 dark:bg-popover/90">
          {navLinks.map((link) => {
            const Icon = navIcons[link.href as keyof typeof navIcons] ?? Shield
            const isActive = isActivePath(pathname, link.href)

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative inline-flex min-w-[68px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 h-1 w-1 rounded-full transition-opacity',
                    isActive ? 'bg-accent opacity-100' : 'opacity-0'
                  )}
                  aria-hidden="true"
                />
                <Icon
                  size={18}
                  strokeWidth={2}
                  className={cn(isActive && 'text-accent')}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap leading-none">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
