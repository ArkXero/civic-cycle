import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { extractTranscript, parseYouTubeUrl } from '@/lib/youtube'

interface Meeting {
  id: string
  video_url: string | null
  youtube_video_id: string | null
  transcript_text: string | null
}

// POST /api/meetings/[id]/fetch-transcript - Fetch transcript from YouTube for existing meeting
export async function POST(
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
        { error: 'Unauthorized', message: 'You must be logged in to fetch transcripts' },
        { status: 401 }
      )
    }

    const adminClient = createAdminClient()

    // Get the meeting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: meeting, error: fetchError } = await (adminClient
      .from('meetings') as any)
      .select('id, video_url, youtube_video_id, transcript_text')
      .eq('id', id)
      .single() as { data: Meeting | null; error: Error | null }

    if (fetchError || !meeting) {
      return NextResponse.json(
        { error: 'Not found', message: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Get video ID from youtube_video_id or parse from video_url
    let videoId = meeting.youtube_video_id

    if (!videoId && meeting.video_url) {
      videoId = parseYouTubeUrl(meeting.video_url)
    }

    if (!videoId) {
      return NextResponse.json(
        { error: 'No video', message: 'This meeting has no YouTube video associated with it' },
        { status: 400 }
      )
    }

    // Check if we should overwrite existing transcript
    const body = await request.json().catch(() => ({}))
    const forceRefresh = body.force === true

    if (meeting.transcript_text && !forceRefresh) {
      return NextResponse.json(
        { error: 'Transcript exists', message: 'This meeting already has a transcript. Set force=true to overwrite.' },
        { status: 409 }
      )
    }

    // Extract transcript from YouTube
    let transcript: string
    try {
      transcript = await extractTranscript(videoId)
    } catch (extractError) {
      return NextResponse.json(
        {
          error: 'Extraction failed',
          message: extractError instanceof Error ? extractError.message : 'Could not extract transcript'
        },
        { status: 500 }
      )
    }

    // Update meeting with transcript
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updateData, error: updateError } = await (adminClient
      .from('meetings') as any)
      .update({
        transcript_text: transcript,
        youtube_video_id: videoId,
      })
      .eq('id', id)
      .select('id, transcript_text')
      .single()

    console.log('Update result:', { updateData, updateError })

    if (updateError) {
      console.error('Failed to save transcript:', updateError)
      return NextResponse.json(
        { error: 'Save failed', message: 'Extracted transcript but failed to save it' },
        { status: 500 }
      )
    }

    // Revalidate the meeting page cache
    revalidatePath(`/meetings/${id}`)

    return NextResponse.json({
      message: 'Transcript fetched successfully',
      data: {
        meetingId: id,
        wordCount: transcript.split(/\s+/).length,
        source: 'youtube_auto',
      },
    })
  } catch (error) {
    console.error('Error fetching transcript:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcript', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
