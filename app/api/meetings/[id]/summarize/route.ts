import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { runSummarize } from '@/lib/run-summarize'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

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

    const supabase = await createClient()

    // Check if user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to summarize meetings' },
        { status: 401 }
      )
    }

    if (!await isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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

    // Check if already processing — allow retry if stuck for over 10 minutes
    if (meeting.status === 'processing') {
      const updatedAt = new Date(meeting.updated_at)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
      if (updatedAt < tenMinutesAgo) {
        // Stuck — reset so we can retry
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminClient.from('meetings') as any)
          .update({ status: 'pending' })
          .eq('id', id)
      } else {
        return NextResponse.json(
          { error: 'Processing', message: 'Summary is already being generated' },
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

    const supabase = await createClient()

    // Check if user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to delete summaries' },
        { status: 401 }
      )
    }

    if (!await isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
