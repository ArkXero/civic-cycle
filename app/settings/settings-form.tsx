'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Mail, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ACTIVE_SCHOOL_DISTRICTS,
  isSchoolDistrictId,
  type SchoolDistrictId,
} from '@/lib/school-districts'

interface SettingsFormProps {
  email: string
  initialPreferredDistrictId: SchoolDistrictId | null
  reason?: string
  redirectTo: string
}

export function SettingsForm({
  email,
  initialPreferredDistrictId,
  reason,
  redirectTo,
}: SettingsFormProps) {
  const [preferredDistrictId, setPreferredDistrictId] = useState<SchoolDistrictId | ''>(
    initialPreferredDistrictId ?? ''
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const needsCounty = reason === 'choose-county' || !initialPreferredDistrictId

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (!isSchoolDistrictId(preferredDistrictId)) {
      setError('Choose a county before saving.')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredDistrictId }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Failed to save settings.')
        return
      }

      setMessage('County preference saved.')
      if (needsCounty) {
        window.setTimeout(() => {
          window.location.assign(redirectTo || '/meetings')
        }, 650)
      }
    } catch {
      setError('An unexpected error occurred while saving settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordReset = async () => {
    setMessage(null)
    setError(null)
    setIsResettingPassword(true)

    try {
      const response = await fetch('/api/account/password-reset', {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Failed to send password reset email.')
        return
      }

      setMessage('Password reset email sent.')
    } catch {
      setError('An unexpected error occurred while sending the reset email.')
    } finally {
      setIsResettingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      {needsCounty && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm text-foreground">
          Choose a county to finish setting up your account.
        </div>
      )}

      {message && (
        <div className="flex items-start gap-2 rounded-lg border border-green-500/25 bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Mail className="h-5 w-5 text-primary" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountEmail">Email</Label>
            <Input id="accountEmail" value={email} readOnly />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handlePasswordReset}
            disabled={isResettingPassword}
          >
            {isResettingPassword ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            Send password reset email
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <MapPin className="h-5 w-5 text-primary" />
            County
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preferredDistrict">Preferred county</Label>
              <Select
                value={preferredDistrictId}
                onValueChange={(value) => {
                  if (isSchoolDistrictId(value)) {
                    setPreferredDistrictId(value)
                  }
                }}
                disabled={isSaving}
              >
                <SelectTrigger id="preferredDistrict">
                  <SelectValue placeholder="Choose your county" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVE_SCHOOL_DISTRICTS.map((district) => (
                    <SelectItem key={district.id} value={district.id}>
                      {district.schoolSystemLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save county
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
