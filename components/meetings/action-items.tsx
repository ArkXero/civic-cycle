import type { ActionItem } from '@/types'

interface ActionItemsProps {
  items: ActionItem[]
}

export function ActionItems({ items }: ActionItemsProps) {
  if (!items || items.length === 0) {
    return null
  }

  return (
    <section>
      <div className="border-b-2 border-rule pb-3">
        <h2 className="text-xl font-extrabold text-foreground">Follow-ups</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          What the board asked for next, and who owns it.
        </p>
      </div>
      <ul>
        {items.map((item, index) => (
          <li
            key={index}
            className="grid gap-1 border-b border-border py-4 sm:grid-cols-[1fr_auto] sm:gap-6"
          >
            <p className="max-w-[68ch] text-[15px] font-medium text-foreground">{item.item}</p>
            {(item.responsible_party || item.deadline) && (
              <p className="docket sm:pt-1 sm:text-right">
                {[item.responsible_party, item.deadline].filter(Boolean).join(' · ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
