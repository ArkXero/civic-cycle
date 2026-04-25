'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, Sun, Moon } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { APP_NAME, NAV_LINKS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { isAdminJwt } from '@/lib/auth/get-role'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import type { User } from '@supabase/supabase-js'

export function Header() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [supabase] = useState(() => createClient())
  const { theme, setTheme } = useTheme()

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setIsOpen(false)
  }

  const visibleLinks = NAV_LINKS.filter(
    (link) => (!link.protected || user) && (!link.adminOnly || isAdmin)
  )

  return (
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
          {user ? (
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
          )}
        </nav>

        {/* Mobile hamburger */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <button
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[280px] bg-white dark:bg-[#0D2B33] border-l border-border"
          >
            <div className="flex items-center gap-2.5 mb-8 pt-2">
              <Image src="/favicon.png" alt={APP_NAME} width={26} height={26} unoptimized className="rounded-md" />
              <span
                className="text-[16px] text-foreground"
                style={{ fontFamily: 'var(--font-display-var), Georgia, serif', fontWeight: 400 }}
              >
                {APP_NAME}
              </span>
            </div>

            <nav className="flex flex-col gap-1">
              {visibleLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'px-3 py-2.5 rounded-md text-base font-medium transition-colors',
                    pathname === link.href
                      ? 'text-[#F5A623] bg-secondary font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                  style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mt-6 pt-6 border-t border-border flex flex-col gap-3">
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="w-full px-3 py-2.5 rounded-md text-base font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-left"
                  style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => setIsOpen(false)}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-md text-base font-semibold text-white bg-primary hover:bg-[#157f8e] transition-colors"
                  style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
                >
                  Sign In
                </Link>
              )}

              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
              )}
            </div>
          </SheetContent>
        </Sheet>

      </div>
    </header>
  )
}
