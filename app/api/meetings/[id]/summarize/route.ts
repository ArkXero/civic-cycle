import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/is-admin'
import { runSummarize } from '@/lib/run-summarize'

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
    const supabase = await createClient()

    // Check if user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to summarize meetings' },
        { status: 401 }
      )
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the meeting with its transcript
    const adminClient = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: meeting, error: fetchError } = await (adminClient
      .from('meetings') as any)
      .select('id, title, transcript_text, status, updated_at')
      .eq('id', id)
      .single() as { data: Meeting | null; error: Error | null }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingSummary } = await (adminClient
      .from('summaries') as any)
      .select('id')
      .eq('meeting_id', id)
      .single()

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
    const supabase = await createClient()

    // Check if user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to delete summaries' },
        { status: 401 }
      )
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Delete the summary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (adminClient
      .from('summaries') as any)
      .delete()
      .eq('meeting_id', id)

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
