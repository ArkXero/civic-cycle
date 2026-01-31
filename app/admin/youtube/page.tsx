import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { YouTubeImporter } from '@/components/youtube/youtube-importer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Import from YouTube',
  description: 'Import FCPS School Board meeting videos from YouTube',
}

export default async function YouTubeAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?redirect=/admin/youtube')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Import from YouTube
        </h1>
        <p className="text-muted-foreground">
          Browse the FCPS School Board YouTube playlist and import meeting videos.
          After importing, you can fetch transcripts and generate AI summaries.
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">How it works</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Browse videos from the FCPS School Board YouTube playlist below</li>
          <li>Click &quot;Import Meeting&quot; to add a video to the system</li>
          <li>Go to the meeting page and click &quot;Fetch Transcript from YouTube&quot;</li>
          <li>Once transcript is fetched, click &quot;Generate AI Summary&quot;</li>
        </ol>
      </div>

      <YouTubeImporter />
    </div>
  )
}
