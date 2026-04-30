import { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Unsubscribe — Weekly Digest',
}

interface UnsubscribeDigestPageProps {
  params: Promise<{ token: string }>
}

interface SubscriberRow {
  id: string
  active: boolean
}

async function deactivateDigestSubscriber(
  token: string
): Promise<{ success: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { data, error: fetchError } = await supabase
    .from('digest_subscribers')
    .select('id, active')
    .eq('unsubscribe_token', token)
    .single() as { data: SubscriberRow | null; error: Error | null }

  if (fetchError || !data) {
    return { success: false, error: 'Subscription not found' }
  }

  if (!data.active) {
    return { success: true }
  }

  const { error: updateError } = await supabase
    .from('digest_subscribers')
    .update({ active: false })
    .eq('id', data.id) as { data: null; error: Error | null }

  if (updateError) {
    return { success: false, error: 'Failed to unsubscribe' }
  }

  return { success: true }
}

export default async function UnsubscribeDigestPage({
  params,
}: UnsubscribeDigestPageProps) {
  const { token } = await params
  const result = await deactivateDigestSubscriber(token)

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          {result.success ? (
            <>
              <div className="flex justify-center mb-2">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-center">Unsubscribed</CardTitle>
              <CardDescription className="text-center">
                You&rsquo;ve been removed from the weekly digest.
              </CardDescription>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-2">
                <XCircle className="h-12 w-12 text-red-500" />
              </div>
              <CardTitle className="text-center">Something went wrong</CardTitle>
              <CardDescription className="text-center">
                {result.error ?? 'Unable to process your unsubscribe request.'}
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/">Back to Civic Cycle</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
