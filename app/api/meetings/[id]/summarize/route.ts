import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { summarizeMeeting, chunkTranscript } from '@/lib/anthropic'

interface Meeting {
  id: string
  title: string
  transcript_text: string | null
  status: string
}

// POST /api/meetings/[id]/summarize - Generate AI summary for a meeting
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check if user is authenticated (optional: add admin check)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to summarize meetings' },
        { status: 401 }
      )
    }

    // Get the meeting with its transcript
    const adminClient = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: meeting, error: fetchError } = await (adminClient
      .from('meetings') as any)
      .select('id, title, transcript_text, status')
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

    // Update meeting status to processing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('meetings') as any)
      .update({ status: 'processing' })
      .eq('id', id)

    // Generate summary using Claude
    let summary
    try {
      // Check if transcript needs to be chunked (for very long meetings)
      const chunks = chunkTranscript(meeting.transcript_text)

      if (chunks.length === 1) {
        // Single transcript, summarize directly
        summary = await summarizeMeeting(meeting.transcript_text, meeting.title)
      } else {
        // Multiple chunks - summarize each, then combine
        // For now, just use the first chunk with a note
        // In production, you'd want to summarize all chunks and combine
        console.log(`Transcript split into ${chunks.length} chunks, using first chunk`)
        summary = await summarizeMeeting(
          chunks[0] + '\n\n[Note: This is a partial transcript due to length]',
          meeting.title
        )
      }
    } catch (aiError) {
      console.error('AI summarization failed:', aiError)

      // Reset meeting status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient.from('meetings') as any)
        .update({ status: 'pending' })
        .eq('id', id)

      return NextResponse.json(
        { error: 'AI error', message: 'Failed to generate summary. Please try again.' },
        { status: 500 }
      )
    }

    // Save the summary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: savedSummary, error: saveError } = await (adminClient
      .from('summaries') as any)
      .insert({
        meeting_id: id,
        summary_text: summary.summary_text,
        topics: summary.topics,
        key_decisions: summary.key_decisions,
        action_items: summary.action_items,
        sentiment: summary.sentiment,
        model_version: 'claude-sonnet-4-20250514',
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save summary:', saveError)

      // Reset meeting status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient.from('meetings') as any)
        .update({ status: 'pending' })
        .eq('id', id)

      return NextResponse.json(
        { error: 'Save error', message: 'Generated summary but failed to save it' },
        { status: 500 }
      )
    }

    // Update meeting status to summarized
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('meetings') as any)
      .update({ status: 'summarized' })
      .eq('id', id)

    return NextResponse.json({
      message: 'Summary generated successfully',
      data: savedSummary,
    })
  } catch (error) {
    console.error('Unexpected error in summarize:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'An unexpected error occurred' },
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

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to delete summaries' },
        { status: 401 }
      )
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
