'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
})

interface DigestSignupProps {
  className?: string
}

export function DigestSignup({ className }: DigestSignupProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = schema.safeParse({ email: email.trim() })
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Failed to subscribe')
        return
      }

      setSuccess(true)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <p className={className} style={{ color: '#0D5E6B', fontWeight: 500 }}>
        You&rsquo;re subscribed! Look for your first digest next Sunday.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          style={{ flex: '1', minWidth: '200px' }}
          aria-label="Email address for weekly digest"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Subscribing…' : 'Get Weekly Digest'}
        </Button>
      </div>
      {error && (
        <p style={{ color: '#dc2626', fontSize: '14px', marginTop: '6px' }}>
          {error}
        </p>
      )}
    </form>
  )
}
