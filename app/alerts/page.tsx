import { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { Button } from '@/components/ui/button'
import { AlertsClient } from './alerts-client'

const publicAlertSelect = 'id, keyword, bodies, is_active, created_at'

export const metadata: Metadata = {
  title: 'My Alerts',
  description: 'Manage your keyword alerts',
}

async function getAlerts() {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const db = createAdminClient()
  const { data: alerts } = await db
    .from('alert_preferences')
    .select(publicAlertSelect)
    .eq('user_id', currentUser.profileId)
    .order('created_at', { ascending: false })

  return alerts || []
}

export default async function AlertsPage() {
  const alerts = await getAlerts()

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">My Alerts</h1>
          <p className="text-muted-foreground">
            Get notified when keywords you care about are mentioned in meetings.
          </p>
        </div>
        <Button asChild>
          <Link href="/alerts/new">
            <Plus className="h-4 w-4 mr-2" />
            New Alert
          </Link>
        </Button>
      </div>

      <AlertsClient initialAlerts={alerts} />
    </div>
  )
}
