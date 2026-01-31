import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlaylistVideos, isSchoolBoardMeeting } from '@/lib/youtube'
import { FCPS_YOUTUBE_PLAYLIST_ID } from '@/lib/constants'

// GET /api/youtube/playlist - List videos from FCPS playlist
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to access this feature' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const maxResults = Math.min(100, parseInt(searchParams.get('limit') || '50', 10))
    const filterMeetings = searchParams.get('filter') !== 'false'

    // Get videos from playlist
    const videos = await getPlaylistVideos(FCPS_YOUTUBE_PLAYLIST_ID, maxResults)

    // Optionally filter to only school board meetings
    const filteredVideos = filterMeetings
      ? videos.filter((v) => isSchoolBoardMeeting(v.title))
      : videos

    // Check which videos are already imported
    const videoIds = filteredVideos.map((v) => v.videoId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMeetings } = await (supabase
      .from('meetings') as any)
      .select('youtube_video_id')
      .in('youtube_video_id', videoIds)

    const importedIds = new Set(
      existingMeetings?.map((m: { youtube_video_id: string }) => m.youtube_video_id) || []
    )

    // Add import status to each video
    const videosWithStatus = filteredVideos.map((video) => ({
      ...video,
      isImported: importedIds.has(video.videoId),
    }))

    return NextResponse.json({
      data: videosWithStatus,
      count: videosWithStatus.length,
    })
  } catch (error) {
    console.error('Error fetching playlist:', error)
    return NextResponse.json(
      { error: 'Failed to fetch playlist', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
