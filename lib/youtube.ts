import { google } from 'googleapis'
import { Readable } from 'stream'
import { YoutubeTranscript } from 'youtube-transcript'

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
})

function createOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
  )
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN })
  return oauth2Client
}

export interface YouTubeVideo {
  videoId: string
  title: string
  description: string
  thumbnailUrl: string
  publishedAt: string
  duration: string
  channelTitle: string
}

export interface TranscriptSegment {
  text: string
  offset: number
  duration: number
}

export interface CaptionTrack {
  id: string
  language: string
  trackKind: string
  name: string
  isCC: boolean
}

/**
 * Parse YouTube video ID from various URL formats
 */
export function parseYouTubeUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the video ID
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

/**
 * Convert ISO 8601 duration to human-readable format
 */
export function formatDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return isoDuration

  const hours = match[1] ? parseInt(match[1]) : 0
  const minutes = match[2] ? parseInt(match[2]) : 0
  const seconds = match[3] ? parseInt(match[3]) : 0

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Get videos from a YouTube playlist
 */
export async function getPlaylistVideos(
  playlistId: string,
  maxResults: number = 50
): Promise<YouTubeVideo[]> {
  const videos: YouTubeVideo[] = []
  let pageToken: string | undefined

  do {
    const playlistResponse = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId,
      maxResults: Math.min(maxResults - videos.length, 50),
      pageToken,
    })

    const videoIds = playlistResponse.data.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => !!id) || []

    if (videoIds.length === 0) break

    // Get video details for duration
    const videoResponse = await youtube.videos.list({
      part: ['contentDetails', 'snippet'],
      id: videoIds,
    })

    for (const item of playlistResponse.data.items || []) {
      const videoId = item.contentDetails?.videoId
      if (!videoId) continue

      const videoDetails = videoResponse.data.items?.find(
        (v) => v.id === videoId
      )

      videos.push({
        videoId,
        title: item.snippet?.title || 'Untitled',
        description: item.snippet?.description || '',
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.default?.url ||
          '',
        publishedAt: item.snippet?.publishedAt || '',
        duration: videoDetails?.contentDetails?.duration
          ? formatDuration(videoDetails.contentDetails.duration)
          : '',
        channelTitle: item.snippet?.channelTitle || '',
      })
    }

    pageToken = playlistResponse.data.nextPageToken || undefined
  } while (pageToken && videos.length < maxResults)

  return videos
}

/**
 * Get details for a single YouTube video
 */
export async function getVideoDetails(videoId: string): Promise<YouTubeVideo | null> {
  const response = await youtube.videos.list({
    part: ['snippet', 'contentDetails'],
    id: [videoId],
  })

  const video = response.data.items?.[0]
  if (!video) return null

  return {
    videoId,
    title: video.snippet?.title || 'Untitled',
    description: video.snippet?.description || '',
    thumbnailUrl:
      video.snippet?.thumbnails?.high?.url ||
      video.snippet?.thumbnails?.default?.url ||
      '',
    publishedAt: video.snippet?.publishedAt || '',
    duration: video.contentDetails?.duration
      ? formatDuration(video.contentDetails.duration)
      : '',
    channelTitle: video.snippet?.channelTitle || '',
  }
}

/**
 * List available caption tracks for a YouTube video (requires OAuth)
 */
async function listCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const oauth2Client = createOAuth2Client()
  const youtubeAuth = google.youtube({ version: 'v3', auth: oauth2Client })

  const response = await youtubeAuth.captions.list({
    part: ['snippet'],
    videoId,
  })

  return (response.data.items || []).map((item) => ({
    id: item.id!,
    language: item.snippet?.language || '',
    trackKind: item.snippet?.trackKind || '',
    name: item.snippet?.name || '',
    isCC: item.snippet?.isCC ?? false,
  }))
}

/**
 * Parse SRT caption format into timed segments
 */
function parseSrt(srt: string): Array<{ text: string; start: number }> {
  const segments: Array<{ text: string; start: number }> = []
  const blocks = srt.split(/\n\n+/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const timeLineIdx = lines.findIndex((l) => l.includes('-->'))
    if (timeLineIdx === -1) continue

    const timeMatch = lines[timeLineIdx].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/)
    if (!timeMatch) continue

    const start =
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3]) +
      parseInt(timeMatch[4]) / 1000

    const text = lines
      .slice(timeLineIdx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim()

    if (text) segments.push({ text, start })
  }

  return segments
}

/**
 * Download a caption track via the official YouTube Captions API (requires OAuth).
 * Note: Only works if you own the video or the track has isCC=true.
 */
async function downloadCaptions(captionId: string): Promise<string> {
  const oauth2Client = createOAuth2Client()
  const youtubeAuth = google.youtube({ version: 'v3', auth: oauth2Client })

  const response = await youtubeAuth.captions.download(
    { id: captionId, tfmt: 'srt' },
    { responseType: 'stream' },
  )

  const readable = response.data as Readable

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    readable.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
    readable.on('end', () => {
      const srt = Buffer.concat(chunks).toString('utf-8')
      resolve(buildTranscriptFromSegments(parseSrt(srt)))
    })
    readable.on('error', reject)
  })
}

/**
 * Combine timed segments into paragraphs (~60-second chunks)
 */
function buildTranscriptFromSegments(
  segments: Array<{ text: string; start: number }>,
): string {
  const paragraphs: string[] = []
  let currentParagraph: string[] = []
  let lastStart = 0

  for (const segment of segments) {
    if (segment.start - lastStart > 60 && currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join(' '))
      currentParagraph = []
    }
    currentParagraph.push(segment.text)
    lastStart = segment.start
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '))
  }

  return paragraphs.join('\n\n')
}


/**
 * Extract transcript from YouTube video.
 * Tries the official YouTube Captions API (OAuth) first if credentials are configured,
 * then falls back to the youtube-transcript package.
 */
export async function extractTranscript(videoId: string): Promise<string> {
  // Try official YouTube Captions API if OAuth credentials are configured
  if (
    process.env.YOUTUBE_CLIENT_ID &&
    process.env.YOUTUBE_CLIENT_SECRET &&
    process.env.YOUTUBE_REFRESH_TOKEN
  ) {
    try {
      console.log('Attempting transcript via YouTube Captions API...')
      const tracks = await listCaptionTracks(videoId)
      console.log(
        'Available caption tracks:',
        tracks.map((t) => `${t.language} (${t.trackKind})`).join(', '),
      )

      if (tracks.length === 0) {
        throw new Error('No caption tracks found via API')
      }

      // Prefer manual English > ASR English > any English > first available
      const selected =
        tracks.find((t) => t.language.startsWith('en') && t.trackKind === 'standard') ||
        tracks.find((t) => t.language.startsWith('en') && t.trackKind === 'asr') ||
        tracks.find((t) => t.language.startsWith('en')) ||
        tracks[0]

      console.log('Selected track:', selected.language, selected.trackKind)

      const transcript = await downloadCaptions(selected.id)

      if (!transcript.trim()) {
        throw new Error('Downloaded caption was empty')
      }

      console.log('Transcript extracted via Captions API, length:', transcript.length)
      return transcript
    } catch (apiError) {
      console.warn(
        'YouTube Captions API failed, falling back to youtube-transcript:',
        apiError instanceof Error ? apiError.message : apiError,
      )
    }
  }

  // Fallback: youtube-transcript package
  try {
    console.log('Fetching transcript via youtube-transcript for video:', videoId)

    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' })
    console.log('Segment count:', segments.length)

    if (segments.length === 0) {
      throw new Error('No caption segments found')
    }

    const fullTranscript = buildTranscriptFromSegments(
      segments.map((s) => ({ text: s.text, start: s.offset })),
    )
    console.log('Transcript extracted, length:', fullTranscript.length)

    if (!fullTranscript.trim()) {
      throw new Error('Transcript was empty after processing')
    }

    return fullTranscript
  } catch (error) {
    console.error('Failed to extract transcript:', error)
    throw new Error(
      error instanceof Error
        ? `Transcript extraction failed: ${error.message}`
        : 'Failed to extract transcript. The video may not have captions available.',
    )
  }
}

/**
 * Parse meeting date from video title
 * Tries to extract dates like "January 2025", "Jan 15, 2025", etc.
 */
export function parseMeetingDateFromTitle(title: string): string | null {
  // Try various date patterns
  const patterns = [
    // "January 15, 2025" or "January 15 2025"
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
    // "01/15/2025" or "01-15-2025"
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    // "January 2025" (use 1st of month)
    /(\w+)\s+(\d{4})/,
  ]

  const months: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3,
    may: 4, june: 5, july: 6, august: 7,
    september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3,
    jun: 5, jul: 6, aug: 7, sep: 8, sept: 8,
    oct: 9, nov: 10, dec: 11,
  }

  // Pattern 1: Full date with day
  const fullDateMatch = title.match(patterns[0])
  if (fullDateMatch) {
    const monthName = fullDateMatch[1].toLowerCase()
    const day = parseInt(fullDateMatch[2])
    const year = parseInt(fullDateMatch[3])
    const month = months[monthName]

    if (month !== undefined && !isNaN(day) && !isNaN(year)) {
      const date = new Date(year, month, day)
      return date.toISOString().split('T')[0]
    }
  }

  // Pattern 2: Numeric date
  const numericMatch = title.match(patterns[1])
  if (numericMatch) {
    const month = parseInt(numericMatch[1]) - 1
    const day = parseInt(numericMatch[2])
    const year = parseInt(numericMatch[3])

    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      const date = new Date(year, month, day)
      return date.toISOString().split('T')[0]
    }
  }

  // Pattern 3: Month and year only
  const monthYearMatch = title.match(patterns[2])
  if (monthYearMatch) {
    const monthName = monthYearMatch[1].toLowerCase()
    const year = parseInt(monthYearMatch[2])
    const month = months[monthName]

    if (month !== undefined && !isNaN(year)) {
      const date = new Date(year, month, 1)
      return date.toISOString().split('T')[0]
    }
  }

  return null
}

/**
 * Determine if a video title looks like a school board meeting
 */
export function isSchoolBoardMeeting(title: string): boolean {
  const keywords = [
    'school board',
    'board meeting',
    'regular meeting',
    'work session',
    'public hearing',
    'fcps',
  ]

  const lowerTitle = title.toLowerCase()
  return keywords.some((keyword) => lowerTitle.includes(keyword))
}
