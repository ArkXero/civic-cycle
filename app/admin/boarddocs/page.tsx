import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BoardDocsImporter } from '@/components/boarddocs/boarddocs-importer'
import { isAdminEmail } from '@/lib/is-admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Import from BoardDocs',
  description: 'Import FCPS School Board meeting agendas from BoardDocs',
}

export default async function BoardDocsAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/admin/boarddocs')
  }

  if (!isAdminEmail(user.email)) {
    redirect('/')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Import from BoardDocs
        </h1>
        <p className="text-muted-foreground">
          Browse FCPS School Board meeting agendas from BoardDocs and import them for AI summarization.
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">How it works</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Browse meetings from the FCPS BoardDocs system below</li>
          <li>Click &quot;Import&quot; to fetch the full agenda and save it to the system</li>
          <li>Go to the meeting page and click &quot;Generate AI Summary&quot;</li>
        </ol>
      </div>

      <BoardDocsImporter />
    </div>
  )
}
