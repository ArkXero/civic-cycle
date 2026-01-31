import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractTranscript } from '@/lib/youtube'

// GET /api/youtube/transcript/[videoId] - Get transcript for a YouTube video
export async function GET(
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
        { error: 'Unauthorized', message: 'You must be logged in to access transcripts' },
        { status: 401 }
      )
    }

    // Extract transcript
    const transcript = await extractTranscript(videoId)

    return NextResponse.json({
      data: {
        videoId,
        transcript,
        wordCount: transcript.split(/\s+/).length,
      },
    })
  } catch (error) {
    console.error('Error extracting transcript:', error)
    return NextResponse.json(
      {
        error: 'Transcript extraction failed',
        message: error instanceof Error ? error.message : 'Could not extract transcript. The video may not have captions.'
      },
      { status: 500 }
    )
  }
}
