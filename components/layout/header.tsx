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
  Shield,
  Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME, NAV_LINKS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { isAdminJwt } from '@/lib/auth/get-role'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import type { User } from '@supabase/supabase-js'

const mobileNavIcons = {
  '/': Home,
  '/meetings': ListTree,
  '/calendar': CalendarDays,
  '/alerts': Bell,
  '/admin/boarddocs': FileDown,
  '/admin/dashboard': LayoutDashboard,
} as const

export function Header() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [supabase] = useState(() => createClient())
  const { theme, setTheme } = useTheme()

  useEffect(() => { setMounted(true) }, [])

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

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-white dark:bg-[#0D2B33] border-b border-border shadow-[0_1px_0_rgba(26,138,154,0.06)]">
        <div className="max-w-[1200px] mx-auto flex h-16 items-center justify-between px-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/favicon.png"
              alt={APP_NAME}
              width={28}
              height={28}
              priority
              unoptimized
              className="rounded-md"
            />
            <span
              className="text-[17px] text-foreground tracking-[-0.01em]"
              style={{ fontFamily: 'var(--font-display-var), Georgia, serif', fontWeight: 400 }}
            >
              {APP_NAME}
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'relative px-3.5 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'text-[#F5A623] font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                  style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
                >
                  {link.label}
                  {/* Active underline — teal, not amber */}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-3.5 right-3.5 h-[2px] rounded-full bg-[#F5A623]"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              )
            })}

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-2" />

            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
              </button>
            )}

            {/* Auth */}
            {!authLoading && (user ? (
              <button
                onClick={handleSignOut}
                className="ml-1 px-3.5 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/auth/login"
                className="ml-1 inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold text-white bg-primary hover:bg-[#157f8e] transition-colors"
                style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
              >
                Sign In
              </Link>
            ))}
          </nav>

          {/* Mobile header actions */}
          <div className="flex items-center gap-1.5 md:hidden">
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
                style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
              >
                Sign Out
              </button>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card/95 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] dark:bg-popover/90"
                style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
              >
                Sign In
              </Link>
            ))}
          </div>

        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/92 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl md:hidden dark:bg-[#061820]/92"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-md items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-card/95 p-1.5 dark:bg-popover/90">
          {visibleLinks.map((link) => {
            const Icon = mobileNavIcons[link.href as keyof typeof mobileNavIcons] ?? Shield
            const isActive = pathname === link.href

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
                style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
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
