'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MEETING_BODIES } from '@/lib/constants'

interface AlertFormProps {
  onSuccess?: () => void
}

export function AlertForm({ onSuccess }: AlertFormProps) {
  const [keyword, setKeyword] = useState('')
  const [selectedBodies, setSelectedBodies] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleBodyToggle = (body: string) => {
    setSelectedBodies(prev =>
      prev.includes(body)
        ? prev.filter(b => b !== body)
        : [...prev, body]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (keyword.trim().length < 2) {
      setError('Keyword must be at least 2 characters')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          bodies: selectedBodies,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Failed to create alert')
        return
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/alerts')
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Keyword Alert</CardTitle>
        <CardDescription>
          Get notified when this keyword is mentioned in meeting summaries.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="keyword">Keyword or Phrase</Label>
            <Input
              id="keyword"
              type="text"
              placeholder='e.g., "bell schedule", "budget", "Tysons"'
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              required
              minLength={2}
              maxLength={100}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              You&apos;ll receive an email when this keyword appears in a meeting summary.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Meeting Bodies (optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Leave all unchecked to watch all meeting bodies.
            </p>
            <div className="flex flex-wrap gap-2">
              {MEETING_BODIES.map((body) => (
                <Button
                  key={body}
                  type="button"
                  variant={selectedBodies.includes(body) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleBodyToggle(body)}
                  disabled={isLoading}
                >
                  {body}
                </Button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Alert...
              </>
            ) : (
              'Create Alert'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
