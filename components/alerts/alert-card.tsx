'use client'

import { useState } from 'react'
import { Trash2, Bell, BellOff, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { PublicAlertPreference } from '@/types'

interface AlertCardProps {
  alert: PublicAlertPreference
  onDelete: (id: string) => Promise<void>
  onToggle: (id: string, isActive: boolean) => Promise<void>
}

export function AlertCard({ alert, onDelete, onToggle }: AlertCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this alert?')) return

    setIsDeleting(true)
    try {
      await onDelete(alert.id)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      await onToggle(alert.id, !alert.is_active)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <Card className={!alert.is_active ? 'opacity-60' : ''}>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground">{alert.keyword}</span>
            {!alert.is_active && (
              <Badge variant="secondary" className="text-xs">Paused</Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {alert.bodies && alert.bodies.length > 0 ? (
              <span>Watching: {alert.bodies.join(', ')}</span>
            ) : (
              <span>Watching: All meeting bodies</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Created {formatDate(alert.created_at)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            disabled={isToggling || isDeleting}
            title={alert.is_active ? 'Pause alert' : 'Resume alert'}
          >
            {isToggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : alert.is_active ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={isDeleting || isToggling}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Delete alert"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
