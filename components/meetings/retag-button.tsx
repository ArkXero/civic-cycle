'use client'

import { useState } from 'react'
import { Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RetagButton({ meetingId }: { meetingId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const retag = async () => {
    setState('loading')
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/meetings/${meetingId}/retag`, { method: 'POST' })
      const body = await response.json() as { assignmentCount?: number; error?: string; autoPublishEnabled?: boolean }
      if (!response.ok) throw new Error(body.error ?? 'Retagging failed')
      setState('success')
      setMessage(`${body.assignmentCount ?? 0} assignments classified${body.autoPublishEnabled ? '' : '; review required'}.`)
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Retagging failed')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => void retag()} disabled={state === 'loading'}>
        <Tags /> {state === 'loading' ? 'Retagging…' : 'Retag topics'}
      </Button>
      {message && (
        <span className={state === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'} role="status">
          {message}
        </span>
      )}
    </div>
  )
}
