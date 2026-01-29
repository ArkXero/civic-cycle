'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertList } from '@/components/alerts/alert-list'
import type { AlertPreference } from '@/types'

interface AlertsClientProps {
  initialAlerts: AlertPreference[]
}

export function AlertsClient({ initialAlerts }: AlertsClientProps) {
  const [alerts, setAlerts] = useState(initialAlerts)
  const router = useRouter()

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/alerts/${id}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      setAlerts(prev => prev.filter(alert => alert.id !== id))
    } else {
      const data = await response.json()
      alert(data.message || 'Failed to delete alert')
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    const response = await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    })

    if (response.ok) {
      setAlerts(prev => prev.map(a =>
        a.id === id ? { ...a, is_active: isActive } : a
      ))
    } else {
      const data = await response.json()
      alert(data.message || 'Failed to update alert')
    }
  }

  return (
    <AlertList
      alerts={alerts}
      onDelete={handleDelete}
      onToggle={handleToggle}
    />
  )
}
