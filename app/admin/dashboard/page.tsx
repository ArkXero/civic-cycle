import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/is-admin'
import { DashboardClient } from '@/components/admin/dashboard-client'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Civic Cycle admin overview — meetings, API usage, alerts, and system health',
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/admin/dashboard')
  }

  if (!isAdminEmail(user.email)) {
    redirect('/unauthorized')
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <DashboardClient />
    </div>
  )
}
