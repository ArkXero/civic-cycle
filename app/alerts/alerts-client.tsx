'use client'

import { useState } from 'react'
import { AlertList } from '@/components/alerts/alert-list'
import { apiCall } from '@/lib/api/fetch'
import type { PublicAlertPreference } from '@/types'

interface AlertsClientProps {
  initialAlerts: PublicAlertPreference[]
}

export function AlertsClient({ initialAlerts }: AlertsClientProps) {
  const [alerts, setAlerts] = useState(initialAlerts)

  const handleDelete = async (id: string) => {
    try {
      await apiCall(`/api/alerts/${id}`, { method: 'DELETE' })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete alert')
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await apiCall(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      })
      setAlerts(prev => prev.map(a => (a.id === id ? { ...a, is_active: isActive } : a)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update alert')
    }
  }

  return <AlertList alerts={alerts} onDelete={handleDelete} onToggle={handleToggle} />
}
