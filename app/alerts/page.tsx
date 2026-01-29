import { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { AlertsClient } from './alerts-client'

export const metadata: Metadata = {
  title: 'My Alerts',
  description: 'Manage your keyword alerts',
}

async function getAlerts() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data: alerts } = await supabase
    .from('alert_preferences')
    .select('*')
    .eq('user_id', user.id)
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
