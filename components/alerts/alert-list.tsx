'use client'

import { AlertCard } from './alert-card'
import { Bell } from 'lucide-react'
import type { AlertPreference } from '@/types'

interface AlertListProps {
  alerts: AlertPreference[]
  onDelete: (id: string) => Promise<void>
  onToggle: (id: string, isActive: boolean) => Promise<void>
}

export function AlertList({ alerts, onDelete, onToggle }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No alerts yet</h3>
        <p className="text-muted-foreground">
          Create your first keyword alert to get notified when topics you care about are discussed.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onDelete={onDelete}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}
