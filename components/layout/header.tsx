'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { APP_NAME, NAV_LINKS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

export function Header() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isOpen, setIsOpen] = useState(false)
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setIsOpen(false)
  }

  const visibleLinks = NAV_LINKS.filter(
    (link) => !link.protected || user
  )

  return (
    <header
      className="sticky top-0 z-50 w-full nav-blur"
      style={{
        borderBottom: '1px solid rgba(26, 138, 154, 0.25)',
      }}
    >
      <div className="max-w-[1200px] mx-auto flex h-16 items-center justify-between px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 group"
        >
          <Image src="/logo.png" alt={APP_NAME} width={32} height={32} priority />
          <span
            className="text-lg text-white"
            style={{ fontFamily: 'var(--font-display-var), Georgia, serif', fontWeight: 400 }}
          >
            {APP_NAME}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium tracking-wide transition-colors relative pb-0.5',
                pathname === link.href
                  ? 'text-white'
                  : 'text-white/60 hover:text-white/90'
              )}
              style={{
                fontFamily: 'var(--font-body-var), monospace',
                letterSpacing: '0.05em',
                borderBottom: pathname === link.href ? '2px solid #F5A623' : '2px solid transparent',
              }}
            >
              {link.label}
            </Link>
          ))}

          {user ? (
            <button
              onClick={handleSignOut}
              className="text-sm font-medium tracking-wide text-white/60 hover:text-white/90 transition-colors"
              style={{ fontFamily: 'var(--font-body-var), monospace', letterSpacing: '0.05em' }}
            >
              Sign Out
            </button>
          ) : (
            <Link
              href="/auth/login"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:-translate-y-px"
              style={{
                background: '#1A8A9A',
                fontFamily: 'var(--font-body-var), monospace',
              }}
            >
              Sign In
            </Link>
          )}
        </nav>

        {/* Mobile Navigation */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[300px] sm:w-[400px]"
            style={{ background: '#0D5E6B', borderLeft: '1px solid rgba(26,138,154,0.3)' }}
          >
            <nav className="flex flex-col space-y-6 mt-12 px-2">
              {visibleLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'text-2xl transition-colors',
                    pathname === link.href
                      ? 'text-white'
                      : 'text-white/50 hover:text-white/80'
                  )}
                  style={{ fontFamily: 'var(--font-display-var), Georgia, serif' }}
                >
                  {link.label}
                </Link>
              ))}

              <div className="pt-6" style={{ borderTop: '1px solid rgba(26,138,154,0.3)' }}>
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="text-lg font-medium text-white/50 hover:text-white transition-colors"
                    style={{ fontFamily: 'var(--font-display-var), Georgia, serif' }}
                  >
                    Sign Out
                  </button>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center px-6 py-3 rounded-lg text-lg text-white transition-all"
                    style={{
                      background: '#1A8A9A',
                      fontFamily: 'var(--font-display-var), Georgia, serif',
                      fontWeight: 400,
                    }}
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
