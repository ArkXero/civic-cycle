'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { ArrowRight, CornerDownLeft, Moon, PanelTop, Search, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { NavLink } from '@/lib/constants'
import { setNavLabelMode, useNavLabelMode } from '@/hooks/use-nav-label-mode'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  links: NavLink[]
}

const itemClass =
  'flex cursor-default select-none items-center gap-3 rounded-md px-3 py-2.5 text-sm text-foreground outline-none data-[selected=true]:bg-secondary [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

const SEARCH_ITEM = '__search__'

// Plain substring matching (cmdk's default is fuzzy, which surfaces odd matches for
// short queries). The "search all meetings" item always stays visible.
function filterItems(value: string, search: string, keywords?: string[]) {
  if (value === SEARCH_ITEM) return 1
  const haystack = [value, ...(keywords ?? [])].join(' ').toLowerCase()
  return haystack.includes(search.trim().toLowerCase()) ? 1 : 0
}

const groupClass =
  'px-2 pb-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-muted-foreground'

export function CommandPalette({ open, onOpenChange, links }: CommandPaletteProps) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const navLabelMode = useNavLabelMode()
  const [query, setQuery] = useState('')

  // ⌘K / Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  const run = (action: () => void) => {
    onOpenChange(false)
    setQuery('')
    action()
  }

  const trimmed = query.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden border-border bg-popover p-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 sm:rounded-lg">
        <DialogTitle className="sr-only">Search Civic Cycle</DialogTitle>
        <DialogDescription className="sr-only">
          Jump to a page, or search every meeting summary.
        </DialogDescription>
        <Command loop filter={filterItems} className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-border px-4 pr-12">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search meetings, topics, pages…"
              className="h-13 w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto overscroll-contain py-1">
            <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
              No pages match.
            </Command.Empty>

            {trimmed && (
              <Command.Group heading="Search" className={groupClass}>
                <Command.Item
                  value={SEARCH_ITEM}
                  onSelect={() => run(() => router.push(`/search?q=${encodeURIComponent(trimmed)}`))}
                  className={itemClass}
                >
                  <Search aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    Search all meetings for <span className="font-semibold">“{trimmed}”</span>
                  </span>
                  <CornerDownLeft aria-hidden="true" />
                </Command.Item>
              </Command.Group>
            )}

            <Command.Group heading="Go to" className={groupClass}>
              {[{ href: '/search', label: 'Search' }, ...links].map((link) => (
                <Command.Item
                  key={link.href}
                  value={`go ${link.label}`}
                  onSelect={() => run(() => router.push(link.href))}
                  className={itemClass}
                >
                  <ArrowRight aria-hidden="true" />
                  <span className="flex-1">{link.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Display" className={groupClass}>
              <Command.Item
                value="theme toggle dark light mode"
                onSelect={() => run(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))}
                className={itemClass}
              >
                {resolvedTheme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                <span className="flex-1">
                  Switch to {resolvedTheme === 'dark' ? 'light' : 'dark'} mode
                </span>
              </Command.Item>
              <Command.Item
                value="navigation bar labels names icons only"
                onSelect={() => run(() => setNavLabelMode(navLabelMode === 'labels' ? 'icons' : 'labels'))}
                className={itemClass}
              >
                <PanelTop aria-hidden="true" />
                <span className="flex-1">
                  {navLabelMode === 'labels'
                    ? 'Show icons only in the navigation bar'
                    : 'Show names in the navigation bar'}
                </span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
