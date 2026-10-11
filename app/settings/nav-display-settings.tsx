'use client'

import { PanelTop } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { setNavLabelMode, useNavLabelMode, type NavLabelMode } from '@/hooks/use-nav-label-mode'

const OPTIONS: { value: NavLabelMode; title: string; description: string }[] = [
  {
    value: 'labels',
    title: 'Icons and names',
    description: 'Every tab shows its name next to the icon.',
  },
  {
    value: 'icons',
    title: 'Icons only',
    description: 'A compact bar; a tab shows its name when you hover over it.',
  },
]

export function NavDisplaySettings() {
  const mode = useNavLabelMode()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <PanelTop className="h-5 w-5 text-primary" />
          Navigation bar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div role="radiogroup" aria-label="Navigation bar style" className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const selected = mode === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setNavLabelMode(option.value)}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-foreground/25'
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full border',
                      selected ? 'border-primary' : 'border-muted-foreground/50'
                    )}
                    aria-hidden="true"
                  >
                    {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  {option.title}
                </span>
                <span className="mt-1.5 block pl-6 text-sm text-muted-foreground">
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Applies right away and is remembered on this device.
        </p>
      </CardContent>
    </Card>
  )
}
