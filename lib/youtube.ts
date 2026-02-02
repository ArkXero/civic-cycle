import { google } from 'googleapis'

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
})

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
 * Fetch transcript using innertube API (more reliable)
 */
async function fetchTranscriptViaInnertube(videoId: string): Promise<Array<{ text: string; start: number; duration: number }>> {
  // Get the video page to extract necessary tokens
  const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`

  console.log('Fetching video page for innertube:', videoPageUrl)

  const pageResponse = await fetch(videoPageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  if (!pageResponse.ok) {
    throw new Error(`Failed to fetch video page: ${pageResponse.status}`)
  }

  const html = await pageResponse.text()

  // Extract ytInitialPlayerResponse
  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/)
  if (!playerResponseMatch) {
    throw new Error('Could not find player response in page')
  }

  let playerData
  try {
    playerData = JSON.parse(playerResponseMatch[1])
  } catch (e) {
    throw new Error('Failed to parse player response')
  }

  const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!captions || captions.length === 0) {
    throw new Error('No caption tracks available for this video')
  }

  console.log('Available caption tracks:', captions.map((c: { languageCode: string; kind?: string }) =>
    `${c.languageCode}${c.kind ? ` (${c.kind})` : ''}`
  ).join(', '))

  // Prefer manual English, then auto-generated English, then any English, then first available
  const englishManual = captions.find((t: { languageCode: string; kind?: string }) =>
    (t.languageCode === 'en' || t.languageCode?.startsWith('en')) && !t.kind
  )
  const englishAuto = captions.find((t: { languageCode: string; kind?: string }) =>
    (t.languageCode === 'en' || t.languageCode?.startsWith('en')) && t.kind === 'asr'
  )
  const anyEnglish = captions.find((t: { languageCode: string }) =>
    t.languageCode === 'en' || t.languageCode?.startsWith('en')
  )

  const selectedTrack = englishManual || englishAuto || anyEnglish || captions[0]
  console.log('Selected track:', selectedTrack.languageCode, selectedTrack.kind || 'manual')

  if (!selectedTrack?.baseUrl) {
    throw new Error('No caption URL found')
  }

  // Fetch with srv1 format (simpler XML)
  const captionUrl = selectedTrack.baseUrl + '&fmt=srv1'
  console.log('Fetching caption URL:', captionUrl.substring(0, 100) + '...')

  const captionResponse = await fetch(captionUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })

  if (!captionResponse.ok) {
    throw new Error(`Failed to fetch captions: ${captionResponse.status}`)
  }

  const captionText = await captionResponse.text()
  console.log('Caption response length:', captionText.length)

  if (captionText.length > 0) {
    console.log('Caption preview:', captionText.substring(0, 300))
  }

  return parseCaptionResponse(captionText)
}

/**
 * Parse caption response (handles both XML and JSON formats)
 */
function parseCaptionResponse(content: string): Array<{ text: string; start: number; duration: number }> {
  const segments: Array<{ text: string; start: number; duration: number }> = []

  // Try JSON format first (srv3)
  if (content.trim().startsWith('{')) {
    try {
      const json = JSON.parse(content)
      const events = json.events || []
      for (const event of events) {
        if (event.segs) {
          const text = event.segs.map((s: { utf8: string }) => s.utf8 || '').join('').trim()
          if (text && text !== '\n') {
            segments.push({
              text,
              start: (event.tStartMs || 0) / 1000,
              duration: (event.dDurationMs || 0) / 1000,
            })
          }
        }
      }
      return segments
    } catch (e) {
      console.log('Failed to parse as JSON:', e)
    }
  }

  // Try XML format
  // Match <text start="..." dur="...">content</text>
  const textPattern = /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([^<]*)<\/text>/g
  let match

  while ((match = textPattern.exec(content)) !== null) {
    const start = parseFloat(match[1])
    const duration = parseFloat(match[2])
    // Decode HTML entities
    const text = match[3]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim()

    if (text) {
      segments.push({ text, start, duration })
    }
  }

  return segments
}

/**
 * Extract transcript from YouTube video using auto-generated captions
 */
export async function extractTranscript(videoId: string): Promise<string> {
  try {
    console.log('Fetching transcript for video:', videoId)

    // Use innertube method
    const segments = await fetchTranscriptViaInnertube(videoId)
    console.log('Final segment count:', segments.length)

    if (segments.length === 0) {
      throw new Error('No caption segments found in response')
    }

    // Combine segments into paragraphs (every ~60 seconds)
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

    const fullTranscript = paragraphs.join('\n\n')
    console.log('Transcript extracted, length:', fullTranscript.length)

    if (!fullTranscript || fullTranscript.trim().length === 0) {
      throw new Error('Transcript was empty after processing')
    }

    return fullTranscript
  } catch (error) {
    console.error('Failed to extract transcript:', error)
    throw new Error(
      error instanceof Error
        ? `Transcript extraction failed: ${error.message}`
        : 'Failed to extract transcript. The video may not have captions available.'
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
