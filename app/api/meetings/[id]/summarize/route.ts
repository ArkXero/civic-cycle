import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { createAdminClient } from '@/lib/supabase/server'
import { runSummarize } from '@/lib/run-summarize'
import { z } from 'zod'

const uuidSchema = z.string().uuid()
const STUCK_PROCESSING_THRESHOLD_MS = 3 * 60 * 1000

interface Meeting {
  id: string
  title: string
  transcript_text: string | null
  status: string
  updated_at: string
}

// POST /api/meetings/[id]/summarize - Generate AI summary for a meeting
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const idResult = uuidSchema.safeParse(id)
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!currentUser.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Get the meeting with its transcript
    const adminClient = createAdminClient()

    const meetingResult = await adminClient
      .from('meetings')
      .select('id, title, transcript_text, status, updated_at')
      .eq('id', id)
      .single()
    const { data: meeting, error: fetchError } = meetingResult as unknown as {
      data: Meeting | null
      error: Error | null
    }

    if (fetchError || !meeting) {
      return NextResponse.json(
        { error: 'Not found', message: 'Meeting not found' },
        { status: 404 }
      )
    }

    if (!meeting.transcript_text) {
      return NextResponse.json(
        { error: 'No transcript', message: 'This meeting has no transcript to summarize' },
        { status: 400 }
      )
    }

    const forceReset = request.nextUrl.searchParams.get('force') === 'true'

    // Check if already processing — allow retry if stuck past the Claude timeout.
    if (meeting.status === 'processing') {
      const updatedAt = new Date(meeting.updated_at)
      const stuckThreshold = new Date(Date.now() - STUCK_PROCESSING_THRESHOLD_MS)
      if (forceReset || updatedAt < stuckThreshold) {
        // Stuck or explicitly force-reset — reset so we can retry.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminClient.from('meetings') as any)
          .update({ status: 'pending', error_message: null })
          .eq('id', id)
      } else {
        return NextResponse.json(
          {
            error: 'Processing',
            message: 'Summary is already being generated. Try again after 3 minutes or use force=true to reset.',
          },
          { status: 409 }
        )
      }
    }

    // Check if already summarized
    const existingSummaryResult = await adminClient
      .from('summaries')
      .select('id')
      .eq('meeting_id', id)
      .single()
    const { data: existingSummary } = existingSummaryResult as unknown as {
      data: { id: string } | null
    }

    if (existingSummary) {
      return NextResponse.json(
        { error: 'Already summarized', message: 'This meeting already has a summary. Delete it first to regenerate.' },
        { status: 409 }
      )
    }

    await runSummarize(id, meeting.transcript_text, meeting.title, adminClient)

    return NextResponse.json({ message: 'Summary generated successfully' })
  } catch (error) {
    console.error('Unexpected error in summarize:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/meetings/[id]/summarize - Delete existing summary
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const idResult = uuidSchema.safeParse(id)
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!currentUser.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const adminClient = createAdminClient()

    // Delete the summary
    const deleteSummaryResult = await adminClient
      .from('summaries')
      .delete()
      .eq('meeting_id', id)
    const { error: deleteError } = deleteSummaryResult as unknown as {
      error: Error | null
    }

    if (deleteError) {
      console.error('Failed to delete summary:', deleteError)
      return NextResponse.json(
        { error: 'Delete error', message: 'Failed to delete summary' },
        { status: 500 }
      )
    }

    // Update meeting status back to pending
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('meetings') as any)
      .update({ status: 'pending' })
      .eq('id', id)

    return NextResponse.json({ success: true, message: 'Summary deleted' })
  } catch (error) {
    console.error('Unexpected error in delete summary:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
