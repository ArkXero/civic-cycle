import { CircleDot, User, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ActionItem } from '@/types'

interface ActionItemsProps {
  items: ActionItem[]
}

export function ActionItems({ items }: ActionItemsProps) {
  if (!items || items.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Action Items</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {items.map((item, index) => (
            <li key={index} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="flex items-start gap-3">
                <CircleDot className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">{item.item}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                    {item.responsible_party && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.responsible_party}
                      </span>
                    )}
                    {item.deadline && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.deadline}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
