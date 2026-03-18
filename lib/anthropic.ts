import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface MeetingSummary {
  summary_text: string
  topics: string[]
  key_decisions: { decision: string; context: string }[]
  action_items: { item: string; responsible_party: string | null; deadline: string | null }[]
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
}

const SYSTEM_PROMPT = `You are an expert at analyzing and summarizing government meeting transcripts, specifically school board meetings. Your goal is to help citizens quickly understand what happened in meetings that affect their community.

You will receive a transcript from a Fairfax County Public Schools (FCPS) School Board meeting. Your task is to create a comprehensive but accessible summary.

Guidelines:
- Write in clear, plain language that any resident can understand
- Focus on decisions and discussions that directly impact students, parents, and the community
- Highlight any votes taken and their outcomes
- Note any budget allocations or policy changes
- Identify action items and who is responsible for them
- Be objective and factual - do not add opinions or commentary
- If something is unclear in the transcript, note that rather than guessing`

const USER_PROMPT = `Please analyze this school board meeting transcript and provide a structured summary.

Return your response as a valid JSON object with this exact structure:
{
  "summary_text": "A 2-3 paragraph executive summary of the meeting covering the main topics discussed and key outcomes",
  "topics": ["Array of 3-8 main topics discussed, e.g., 'Budget allocation', 'Mental health services'"],
  "key_decisions": [
    {
      "decision": "Brief description of decision made",
      "context": "Why this decision matters or what led to it"
    }
  ],
  "action_items": [
    {
      "item": "What needs to be done",
      "responsible_party": "Who is responsible (or null if not specified)",
      "deadline": "When it needs to be done (or null if not specified)"
    }
  ],
  "sentiment": "overall tone of the meeting: 'positive', 'neutral', 'negative', or 'mixed'"
}

Important:
- Return ONLY the JSON object, no additional text or markdown formatting
- Ensure all strings are properly escaped for JSON
- Include at least 1 key decision and 1 action item if any are present in the transcript
- If the transcript is too short or unclear, still provide what you can

Here is the transcript:

`

export async function summarizeMeeting(
  transcript: string,
  meetingTitle?: string
): Promise<MeetingSummary> {
  const contextHeader = meetingTitle
    ? `Meeting: ${meetingTitle}\n\n`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: USER_PROMPT + contextHeader + transcript,
      },
    ],
    system: SYSTEM_PROMPT,
  })

  // Extract text from response
  const textContent = response.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON response
  let parsed: MeetingSummary
  try {
    // Try to extract JSON if it's wrapped in markdown code blocks
    let jsonText = textContent.text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }
    jsonText = jsonText.trim()

    parsed = JSON.parse(jsonText)
  } catch (parseError) {
    console.error('Failed to parse Claude response:', textContent.text)
    throw new Error('Failed to parse summary response as JSON')
  }

  // Validate required fields
  if (!parsed.summary_text || !Array.isArray(parsed.topics)) {
    throw new Error('Invalid summary structure returned from Claude')
  }

  // Ensure arrays exist with defaults
  return {
    summary_text: parsed.summary_text,
    topics: parsed.topics || [],
    key_decisions: parsed.key_decisions || [],
    action_items: parsed.action_items || [],
    sentiment: parsed.sentiment || 'neutral',
  }
}

// Estimate token count (rough approximation: ~4 chars per token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Split long transcripts into chunks if needed
export function chunkTranscript(transcript: string, maxTokens: number = 100000): string[] {
  const estimatedTokens = estimateTokens(transcript)

  if (estimatedTokens <= maxTokens) {
    return [transcript]
  }

  // Split by paragraphs or double newlines
  const paragraphs = transcript.split(/\n\n+/)
  const chunks: string[] = []
  let currentChunk = ''

  for (const paragraph of paragraphs) {
    const potentialChunk = currentChunk + '\n\n' + paragraph
    if (estimateTokens(potentialChunk) > maxTokens) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = paragraph
    } else {
      currentChunk = potentialChunk
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}
