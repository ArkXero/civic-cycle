import { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Unsubscribe',
  description: 'Unsubscribe from email alerts',
}

interface UnsubscribePageProps {
  params: Promise<{ token: string }>
}

async function unsubscribeAlert(alertId: string) {
  // The token is the alert ID for simplicity
  // In production, you'd want a secure token system
  const supabase = createAdminClient()

  const { data: alert, error: fetchError } = await supabase
    .from('alert_preferences')
    .select('id, keyword, user_id')
    .eq('id', alertId)
    .single()

  if (fetchError || !alert) {
    return { success: false, error: 'Alert not found' }
  }

  const { error: deleteError } = await supabase
    .from('alert_preferences')
    .delete()
    .eq('id', alertId)

  if (deleteError) {
    return { success: false, error: 'Failed to unsubscribe' }
  }

  return { success: true, keyword: alert.keyword }
}

export default async function UnsubscribePage({ params }: UnsubscribePageProps) {
  const { token } = await params
  const result = await unsubscribeAlert(token)

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <Card>
        <CardHeader className="text-center">
          {result.success ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Unsubscribed</CardTitle>
              <CardDescription>
                You&apos;ve been unsubscribed from alerts for &quot;{result.keyword}&quot;.
              </CardDescription>
            </>
          ) : (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                {result.error || 'We couldn\'t process your unsubscribe request.'}
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="text-center">
          {result.success ? (
            <p className="text-sm text-muted-foreground mb-6">
              You won&apos;t receive any more emails for this keyword.
              You can create new alerts or manage existing ones from your dashboard.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mb-6">
              The alert may have already been deleted, or the link may be invalid.
            </p>
          )}
          <Button asChild>
            <Link href="/alerts">Manage Alerts</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
