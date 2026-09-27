import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { runSummarize } from '@/lib/run-summarize'
import { officialMotionsFromRows } from '@/lib/data/motions'
import { dateInSchoolDistrict, getSchoolDistrict, parseSchoolDistrictId } from '@/lib/school-districts'
import { z } from 'zod'
import type { AgendaItemMotion } from '@/types'

const uuidSchema = z.string().uuid()
const STUCK_PROCESSING_THRESHOLD_MS = 3 * 60 * 1000

interface Meeting {
  id: string
  title: string
  transcript_text: string | null
  status: string
  updated_at: string
  meeting_date: string
  source: string | null
  district_id: string | null
  boarddocs_content_hash: string | null
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
      .select('id, title, transcript_text, status, updated_at, meeting_date, source, district_id, boarddocs_content_hash')
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

    if (!meeting.transcript_text?.trim()) {
      return NextResponse.json(
        { error: 'No transcript', message: 'This meeting has no transcript to summarize' },
        { status: 400 }
      )
    }

    const district = getSchoolDistrict(parseSchoolDistrictId(meeting.district_id))
    if (meeting.meeting_date > dateInSchoolDistrict(district.timeZone)) {
      return NextResponse.json(
        { error: 'Awaiting meeting', message: 'Future meetings cannot be summarized' },
        { status: 409 }
      )
    }

    const forceReset = request.nextUrl.searchParams.get('force') === 'true'

    // Check if already processing — allow retry if stuck past the Claude timeout.
    if (meeting.status === 'processing') {
      const updatedAt = new Date(meeting.updated_at)
      const stuckThreshold = new Date(Date.now() - STUCK_PROCESSING_THRESHOLD_MS)
      if (forceReset || updatedAt < stuckThreshold) {
        // Stuck or explicitly force-reset — reset so we can retry.
        const { error: resetError } = await adminClient
          .from('meetings')
          .update({ status: 'pending', error_message: null })
          .eq('id', id)
        if (resetError) throw resetError
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

    let motionRows: AgendaItemMotion[] = []
    if (meeting.source === 'boarddocs') {
      const { data, error: motionsError } = await adminClient
        .from('agenda_item_motions')
        .select('*')
        .eq('meeting_id', id)
        .order('source_ordinal')
      if (motionsError) throw motionsError
      motionRows = data ?? []

      const hasPublishedBoardDocsResult = motionRows.some((motion) => motion.outcome !== 'unknown')
      if (!hasPublishedBoardDocsResult) {
        return NextResponse.json(
          { error: 'Awaiting results', message: 'Official BoardDocs motion results are not available yet' },
          { status: 409 }
        )
      }
    }

    const result = await runSummarize(
      id,
      meeting.transcript_text,
      meeting.title,
      adminClient,
      {
        sourceContentHash: meeting.boarddocs_content_hash ?? undefined,
        officialMotions: officialMotionsFromRows(motionRows),
        expectedBoardDocsContentHash: meeting.source === 'boarddocs'
          ? meeting.boarddocs_content_hash ?? undefined
          : undefined,
      }
    )

    return NextResponse.json({
      message: result.replacedExisting
        ? 'Summary replaced successfully'
        : 'Summary generated successfully',
      revision: result.revision,
    })
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
