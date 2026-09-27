import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getAccountProfile, getAuthenticatedUser } from '@/lib/account-profile'
import { sanitizeRedirectPath } from '@/lib/auth/redirects'
import { SettingsForm } from './settings-form'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage Civic Cycle account settings',
}

interface SettingsPageProps {
  searchParams: Promise<{
    reason?: string
    redirectTo?: string
  }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)

  if (!user) {
    redirect('/auth/login?redirectTo=/settings')
  }

  const profile = await getAccountProfile(supabase, user)
  const redirectTo = sanitizeRedirectPath(params.redirectTo)

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and default school district.
        </p>
      </div>

      <SettingsForm
        email={profile.email}
        initialPreferredDistrictId={profile.preferredDistrictId}
        reason={params.reason}
        redirectTo={redirectTo}
      />
    </main>
  )
}
