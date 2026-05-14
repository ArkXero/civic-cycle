import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { DashboardClient } from '@/components/admin/dashboard-client'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Civic Cycle admin overview — meetings, API usage, alerts, and system health',
}

export default async function AdminDashboardPage() {
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect('/auth/login?redirect=/admin/dashboard')
  }

  if (!currentUser.isAdmin) {
    redirect('/unauthorized')
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <DashboardClient />
    </div>
  )
}
