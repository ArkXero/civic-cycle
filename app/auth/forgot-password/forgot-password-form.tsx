'use client'

import { useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import {
  buildAuthCallbackUrl,
  DEFAULT_POST_AUTH_REDIRECT_PATH,
  storeAuthRedirectPath,
} from '@/lib/auth/redirects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Loader2 } from 'lucide-react'

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
})

interface ForgotPasswordFormProps {
  redirectTo: string
}

const GENERIC_RESET_EMAIL_ERROR = 'Unable to send reset email. Please try again.'

export function ForgotPasswordForm({ redirectTo }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = forgotPasswordSchema.safeParse({ email })
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }

    setIsLoading(true)

    try {
      const postResetRedirectTo = redirectTo || DEFAULT_POST_AUTH_REDIRECT_PATH
      storeAuthRedirectPath(postResetRedirectTo)

      const { error } = await supabase.auth.resetPasswordForEmail(
        result.data.email,
        {
          redirectTo: buildAuthCallbackUrl(
            window.location.origin,
            postResetRedirectTo
          ),
        }
      )

      if (error) {
        setError(GENERIC_RESET_EMAIL_ERROR)
        return
      }

      setIsSuccess(true)
    } catch {
      setError(GENERIC_RESET_EMAIL_ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Check your email
        </h2>
        <p className="text-muted-foreground mb-4">
          If an account exists for that email address, we&apos;ll send a
          password reset link.
        </p>
        <p className="text-sm text-muted-foreground">
          Open the link in the email to choose a new password.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending reset email...
          </>
        ) : (
          'Send reset email'
        )}
      </Button>
    </form>
  )
}
