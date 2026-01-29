import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AlertForm } from '@/components/alerts/alert-form'

export const metadata: Metadata = {
  title: 'Create Alert',
  description: 'Create a new keyword alert',
}

export default function NewAlertPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/alerts">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Alerts
        </Link>
      </Button>

      <AlertForm />

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium text-foreground mb-2">How alerts work</h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>• When a new meeting summary is published, we check for your keywords</li>
          <li>• If your keyword appears in the summary, topics, or key decisions, you&apos;ll get an email</li>
          <li>• Alerts are case-insensitive (&quot;Budget&quot; matches &quot;budget&quot;)</li>
          <li>• You can pause or delete alerts at any time</li>
        </ul>
      </div>
    </div>
  )
}
