import Anthropic from '@anthropic-ai/sdk'
import { getSummaryModel } from '@/lib/anthropic-models'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface MeetingSummary {
  summary_text: string
  topics: string[]
  key_decisions: { decision: string; vote_yes: number; vote_no: number; vote_abstain: number }[]
  action_items: { item: string; responsible_party: string | null; deadline: string | null }[]
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
}

const SYSTEM_PROMPT = `You are an expert at analyzing and summarizing government meeting transcripts, specifically school board meetings. Your goal is to help citizens quickly understand what happened in meetings that affect their community.

You will receive a transcript from a local school board meeting. Your task is to create a comprehensive but accessible summary.

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
      "decision": "Brief description of the decision, starting with an action verb (e.g. Approved, Denied, Accepted, Directed, Adopted)",
      "vote_yes": 9,
      "vote_no": 0,
      "vote_abstain": 0
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
- For key_decisions, extract the exact vote tally from the transcript (e.g. "9-0", "8-1-0" → vote_yes/vote_no/vote_abstain). If no tally is stated but the motion clearly passed, use vote_yes: 1, vote_no: 0. If it failed, use vote_yes: 0, vote_no: 1
- If the transcript is too short or unclear, still provide what you can

Here is the transcript:

`

export interface SummarizeResult {
  summary: MeetingSummary
  usage: { input_tokens: number; output_tokens: number }
  model: string
}

export interface SummaryQualityIssue {
  code:
    | 'missing_summary_text'
    | 'missing_topics'
    | 'summary_too_short'
    | 'invalid_key_decisions'
    | 'invalid_action_items'
  message: string
}

export class SummaryGenerationError extends Error {
  constructor(
    message: string,
    public readonly model: string,
    public readonly usage?: { input_tokens: number; output_tokens: number },
    public readonly fallbackEligible = false
  ) {
    super(message)
    this.name = 'SummaryGenerationError'
  }
}

export function validateMeetingSummaryQuality(
  summary: MeetingSummary,
  transcript: string
): SummaryQualityIssue[] {
  const issues: SummaryQualityIssue[] = []

  if (!summary.summary_text || typeof summary.summary_text !== 'string') {
    issues.push({
      code: 'missing_summary_text',
      message: 'Summary text is required',
    })
  }

  if (!Array.isArray(summary.topics) || summary.topics.length < 1) {
    issues.push({
      code: 'missing_topics',
      message: 'At least one topic is required',
    })
  }

  if (estimateTokens(transcript) > 1_000 && (summary.summary_text?.length ?? 0) < 200) {
    issues.push({
      code: 'summary_too_short',
      message: 'Summary text is too short for a long transcript',
    })
  }

  if (!Array.isArray(summary.key_decisions)) {
    issues.push({
      code: 'invalid_key_decisions',
      message: 'Key decisions must be an array',
    })
  }

  if (!Array.isArray(summary.action_items)) {
    issues.push({
      code: 'invalid_action_items',
      message: 'Action items must be an array',
    })
  }

  return issues
}

export async function summarizeMeeting(
  transcript: string,
  meetingTitle?: string,
  options?: { model?: string }
): Promise<SummarizeResult> {
  const model = options?.model ?? getSummaryModel()
  const contextHeader = meetingTitle
    ? `Meeting: ${meetingTitle}\n\n`
    : ''

  const response = await anthropic.messages.create({
    model,
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
    throw new SummaryGenerationError(
      'No text response from Claude',
      model,
      response.usage,
      false
    )
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
  } catch {
    console.error('Failed to parse Claude response:', textContent.text)
    throw new SummaryGenerationError(
      'Failed to parse summary response as JSON',
      model,
      response.usage,
      true
    )
  }

  const qualityIssues = validateMeetingSummaryQuality(parsed, transcript)
  if (qualityIssues.length > 0) {
    throw new SummaryGenerationError(
      `Invalid summary structure returned from Claude: ${qualityIssues.map((issue) => issue.code).join(', ')}`,
      model,
      response.usage,
      true
    )
  }

  return {
    summary: {
      summary_text: parsed.summary_text,
      topics: parsed.topics || [],
      key_decisions: parsed.key_decisions || [],
      action_items: parsed.action_items || [],
      sentiment: parsed.sentiment || 'neutral',
    },
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
    model,
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

const SYNTHESIS_PROMPT = `You are merging partial summaries of the same government meeting into one unified summary.

Each partial summary covers a different section of the transcript. Combine them into a single coherent summary using the same JSON structure.

Rules:
- Merge summary_text into 2-3 unified paragraphs covering the full meeting
- Deduplicate topics, keep 3-8 most significant ones
- Include ALL key_decisions from all parts (no deduplication — each vote is distinct)
- Include ALL action_items from all parts (no deduplication)
- Set sentiment to the overall tone across all parts

Return ONLY the JSON object with this exact structure:
{
  "summary_text": "...",
  "topics": [...],
  "key_decisions": [...],
  "action_items": [...],
  "sentiment": "positive|neutral|negative|mixed"
}

Here are the partial summaries to merge:

`

export async function synthesizeChunkSummaries(
  chunkSummaries: MeetingSummary[],
  meetingTitle?: string,
  options?: { model?: string }
): Promise<SummarizeResult> {
  const model = options?.model ?? getSummaryModel()
  const contextHeader = meetingTitle ? `Meeting: ${meetingTitle}\n\n` : ''
  const synthesisInput = JSON.stringify(chunkSummaries, null, 2)

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: SYNTHESIS_PROMPT + contextHeader + synthesisInput,
    }],
    system: SYSTEM_PROMPT,
  })

  const textContent = response.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new SummaryGenerationError(
      'No text response from Claude during synthesis',
      model,
      response.usage,
      false
    )
  }

  let parsed: MeetingSummary
  try {
    let jsonText = textContent.text.trim()
    if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7)
    else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3)
    if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3)
    parsed = JSON.parse(jsonText.trim())
  } catch {
    throw new SummaryGenerationError(
      'Failed to parse synthesis response as JSON',
      model,
      response.usage,
      true
    )
  }

  const qualityIssues = validateMeetingSummaryQuality(parsed, synthesisInput)
  if (qualityIssues.length > 0) {
    throw new SummaryGenerationError(
      `Invalid synthesis structure returned from Claude: ${qualityIssues.map((issue) => issue.code).join(', ')}`,
      model,
      response.usage,
      true
    )
  }

  return {
    summary: {
      summary_text: parsed.summary_text,
      topics: parsed.topics || [],
      key_decisions: parsed.key_decisions || [],
      action_items: parsed.action_items || [],
      sentiment: parsed.sentiment || 'neutral',
    },
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
    model,
  }
}
