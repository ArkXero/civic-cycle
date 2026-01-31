import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getVideoDetails, parseMeetingDateFromTitle } from '@/lib/youtube'

// POST /api/youtube/import/[videoId] - Import a YouTube video as a meeting
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to import videos' },
        { status: 401 }
      )
    }

    // Get optional body from request
    const body = await request.json().catch(() => ({}))
    const meetingBody = body.body || 'FCPS School Board'
    const customDate = body.meeting_date

    // Check if already imported
    const adminClient = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (adminClient
      .from('meetings') as any)
      .select('id')
      .eq('youtube_video_id', videoId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Already imported', message: 'This video has already been imported' },
        { status: 409 }
      )
    }

    // Fetch video details from YouTube
    const video = await getVideoDetails(videoId)

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found', message: 'Could not find video on YouTube' },
        { status: 404 }
      )
    }

    // Parse meeting date from title or use custom date
    const meetingDate = customDate || parseMeetingDateFromTitle(video.title) || new Date().toISOString().split('T')[0]

    // Create meeting record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: meeting, error: insertError } = await (adminClient
      .from('meetings') as any)
      .insert({
        title: video.title,
        body: meetingBody,
        meeting_date: meetingDate,
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
        youtube_video_id: videoId,
        youtube_thumbnail_url: video.thumbnailUrl,
        youtube_duration: video.duration,
        youtube_published_at: video.publishedAt,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to import video:', insertError)
      return NextResponse.json(
        { error: 'Import failed', message: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Video imported successfully',
      data: meeting,
    }, { status: 201 })
  } catch (error) {
    console.error('Error importing video:', error)
    return NextResponse.json(
      { error: 'Import failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
