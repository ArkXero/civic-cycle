import { cn } from '@/lib/utils'

// Both variants fill the area below the curve, so the wave is always drawn in the color
// of the section that follows and its straight edge lands on that same color (a
// straight edge over a different color shows a faint antialiasing line). `flip`
// mirrors the curve vertically for the wave that closes a section.
const WAVE = 'M0 58C220 104 430 124 690 104C930 86 1150 14 1340 10C1385 9 1415 18 1440 30V120H0Z'
const WAVE_FLIPPED = 'M0 62C220 16 430 -4 690 16C930 34 1150 106 1340 110C1385 111 1415 102 1440 90V120H0Z'

/** Full-bleed wave at the bottom of a section; color it with the next section's `fill-*`. */
export function WaveDivider({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={cn('block h-12 w-full md:h-20 lg:h-24', className)}
    >
      <path d={flip ? WAVE_FLIPPED : WAVE} />
    </svg>
  )
}
