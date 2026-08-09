import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { TaxonomyAdmin } from '@/components/admin/taxonomy-admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Topic Taxonomy',
  description: 'Review topic suggestions and manage public meeting filters',
}

export default async function TopicTaxonomyAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/admin/topics')
  if (!await isAdminUser(user)) redirect('/unauthorized')

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Topic Taxonomy</h1>
        <p className="mt-2 text-muted-foreground">
          Review model suggestions before labels become public filters.
        </p>
      </div>
      <TaxonomyAdmin />
    </div>
  )
}
