import { createHash } from 'node:crypto'
import {
  DEFAULT_SCHOOL_DISTRICT_ID,
  getBoardDocsBaseUrl,
  getSchoolDistrict,
  type SchoolDistrictId,
} from '@/lib/school-districts'
import {
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  PDF_DOWNLOAD_TIMEOUT_MS,
  normalizeAgendaMarkdown,
  normalizePdfPages,
} from '@/lib/document-preprocessing'

export interface BoardDocsMeeting {
  id: string          // unique field from API
  name: string
  date: Date
  numberDate: string  // YYYYMMDD format
  unid: string
}

export interface AgendaItem {
  id: string
  name: string
  order: string
  category: string
  type: string         // e.g. "Action", "Information"
  hasAttachment: boolean
}

export interface AgendaItemContent {
  id: string
  name: string
  category: string
  type: string
  recommendedAction: string
  bodyHtml: string
  bodyText: string
  bodyMarkdown: string
  motions: string[]
}

export interface BoardDocsPublicFile {
  id: string
  name: string
  url: string
}

export interface ProcessedBoardDocsDocument extends BoardDocsPublicFile {
  checksumSha256: string | null
  parserName: 'pdf-parse'
  parserVersion: string
  markdown: string | null
  pageCount: number | null
  byteSize: number | null
  status: 'extracted' | 'failed' | 'rejected'
  error: string | null
}

export interface IngestedAgendaItem {
  agenda: AgendaItem
  content: AgendaItemContent
  documents: ProcessedBoardDocsDocument[]
}

export interface MeetingContentResult {
  title: string
  date: Date
  fullText: string
  itemCount: number
  documentCount: number
  agendaItems: IngestedAgendaItem[]
}

const BOARD_DOCS_HOST = 'go.boarddocs.com'
const BOARD_DOCS_TIMEOUT_MS = 20_000
const ATTACHMENT_PARSE_CONCURRENCY = 2

// POST helper for BoardDocs API
async function boardDocsPost(
  districtId: SchoolDistrictId,
  endpoint: string,
  data: Record<string, string> = {}
): Promise<string> {
  const district = getSchoolDistrict(districtId)
  const baseUrl = getBoardDocsBaseUrl(districtId)
  const body = new URLSearchParams({
    current_committee_id: district.boardDocs.committeeId,
    ...data,
  })

  const res = await fetch(`${baseUrl}/${endpoint}?open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': `${baseUrl}/Home`,
      'Origin': 'https://go.boarddocs.com',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
    signal: AbortSignal.timeout(BOARD_DOCS_TIMEOUT_MS),
  })

  if (!res.ok) {
    throw new Error(`BoardDocs API error: ${res.status} ${res.statusText}`)
  }

  return res.text()
}

// Fetch list of all public meetings
export async function listMeetings(
  districtId: SchoolDistrictId = DEFAULT_SCHOOL_DISTRICT_ID
): Promise<BoardDocsMeeting[]> {
  const text = await boardDocsPost(districtId, 'BD-GetMeetingsList')

  if (!text || text.length === 0) {
    return []
  }

  const data = JSON.parse(text) as Array<{
    unique: string
    name: string
    numberdate: string
    unid: string
    current?: string
  }>

  return data
    .filter((m) => m.unique && m.numberdate)
    .map((m) => ({
      id: m.unique,
      name: m.name,
      date: parseNumberDate(m.numberdate),
      numberDate: m.numberdate,
      unid: m.unid,
    }))
}

// Parse YYYYMMDD string to Date
function parseNumberDate(nd: string): Date {
  const year = parseInt(nd.substring(0, 4))
  const month = parseInt(nd.substring(4, 6)) - 1
  const day = parseInt(nd.substring(6, 8))
  return new Date(year, month, day)
}

// Fetch agenda items for a specific meeting (returns HTML, parsed into items)
export async function getMeetingAgenda(
  meetingId: string,
  districtId: SchoolDistrictId = DEFAULT_SCHOOL_DISTRICT_ID
): Promise<AgendaItem[]> {
  const html = await boardDocsPost(districtId, 'BD-GetAgenda', { id: meetingId })

  const items: AgendaItem[] = []
  let currentCategory = ''

  // Parse categories (dt elements with class="category")
  const categoryRegex = /<dt[^>]*class="category[^"]*"[^>]*>.*?<span class="category-name">([^<]+)<\/span><\/dt>/g
  const categoryMap = new Map<string, string>()
  let catMatch
  while ((catMatch = categoryRegex.exec(html)) !== null) {
    // Extract the category ID from the dt
    const idMatch = catMatch[0].match(/id="([A-Z0-9]+)"/)
    if (idMatch) {
      categoryMap.set(idMatch[1], catMatch[1].trim())
    }
  }

  // Parse items (li elements with class containing "item")
  const itemRegex = /<li[^>]*unique="([A-Z0-9]+)"[^>]*Xtitle="([^"]*)"[^>]*>[\s\S]*?<span class="order">([^<]*)<\/span><span class="title">([^<]*)<\/span>[\s\S]*?<\/li>/g
  let itemMatch
  while ((itemMatch = itemRegex.exec(html)) !== null) {
    const xtitle = itemMatch[2]
    const typeParts = xtitle.split(' - ')
    const type = typeParts[0] || ''

    // Find the category this item belongs to by looking at preceding categories
    const itemPos = itemMatch.index
    let closestCategory = ''
    for (const [, catName] of categoryMap) {
      const catPos = html.indexOf(catName)
      if (catPos < itemPos) {
        closestCategory = catName
      }
    }

    items.push({
      id: itemMatch[1],
      name: decodeHtmlEntities(itemMatch[4].trim()),
      order: itemMatch[3].trim(),
      category: closestCategory || currentCategory,
      type: type.trim(),
      hasAttachment: /Contains an Attachment|fa-file-text/i.test(itemMatch[0]),
    })

    currentCategory = closestCategory || currentCategory
  }

  return items
}

// Fetch full content for a single agenda item
export async function getAgendaItemContent(
  itemId: string,
  districtId: SchoolDistrictId = DEFAULT_SCHOOL_DISTRICT_ID
): Promise<AgendaItemContent> {
  const html = await boardDocsPost(districtId, 'BD-GetAgendaItem', { id: itemId })

  // Extract fields from the HTML
  const name = extractField(html, 'Subject') || extractField(html, 'ai-name') || ''
  const category = extractField(html, 'Category') || ''
  const type = extractField(html, 'Type') || ''
  const recommendedAction = extractField(html, 'Recommended Action') || ''

  // Extract the main body content
  const bodyMatch = html.match(/key="publicbody"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)
  const bodyHtml = bodyMatch ? bodyMatch[1] : ''
  const bodyText = stripHtml(bodyHtml)
  const bodyMarkdown = htmlToMarkdown(bodyHtml)

  // Extract motions and voting
  const motions: string[] = []
  const motionRegex = /<div class="motion[^"]*">([\s\S]*?)<\/div>\s*<\/div>/g
  let motionMatch
  while ((motionMatch = motionRegex.exec(html)) !== null) {
    const motionText = stripHtml(motionMatch[1]).trim()
    if (motionText) {
      motions.push(motionText)
    }
  }

  return {
    id: itemId,
    name: stripHtml(name),
    category: stripHtml(category),
    type: stripHtml(type),
    recommendedAction: stripHtml(recommendedAction),
    bodyHtml,
    bodyText,
    bodyMarkdown,
    motions,
  }
}

// Extract a labeled field from the agenda item HTML
function extractField(html: string, label: string): string {
  // Try dl/dt/dd pattern first: <dt>Label</dt><dd>Value</dd>
  const dlRegex = new RegExp(
    `<dt[^>]*>${escapeRegex(label)}</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`,
    'i'
  )
  const dlMatch = html.match(dlRegex)
  if (dlMatch) return dlMatch[1].trim()

  // Try by id pattern
  const idRegex = new RegExp(`id="${escapeRegex(label)}"[^>]*>([\\s\\S]*?)</`, 'i')
  const idMatch = html.match(idRegex)
  if (idMatch) return idMatch[1].trim()

  return ''
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Strip HTML tags and decode entities
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function htmlToMarkdown(html: string) {
  return normalizeAgendaMarkdown(
    html
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level: string, text: string) =>
        `${'#'.repeat(Number(level))} ${stripHtml(text)}\n\n`
      )
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_match, text: string) => `- ${stripHtml(text)}\n`)
      .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_match, row: string) => {
        const cells = [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
          .map((cell) => stripHtml(cell[1]))
        return cells.length ? `| ${cells.join(' | ')} |\n` : ''
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|table)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
  )
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

function parseAnchorAttribute(anchor: string, attribute: string) {
  const match = anchor.match(new RegExp(`\\b${attribute}=["']([^"']+)["']`, 'i'))
  return match?.[1] ?? ''
}

export function isAllowedBoardDocsPdfUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    return (
      url.protocol === 'https:' &&
      url.hostname === BOARD_DOCS_HOST &&
      /\/Board\.nsf\/pfiles\//i.test(url.pathname) &&
      /\/\$file\//i.test(url.pathname) &&
      url.username === '' &&
      url.password === ''
    )
  } catch {
    return false
  }
}

export async function getAgendaItemPublicFiles(
  itemId: string,
  districtId: SchoolDistrictId = DEFAULT_SCHOOL_DISTRICT_ID
): Promise<BoardDocsPublicFile[]> {
  const html = await boardDocsPost(districtId, 'BD-GetPublicFiles', { id: itemId })
  const baseUrl = getBoardDocsBaseUrl(districtId)
  const files: BoardDocsPublicFile[] = []

  for (const match of html.matchAll(/<a\b[^>]*class=["'][^"']*\bpublic-file\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const anchor = match[0]
    const id = parseAnchorAttribute(anchor, 'unique')
    const href = decodeHtmlEntities(parseAnchorAttribute(anchor, 'href'))
    const url = new URL(href, baseUrl).toString()
    if (!id || !isAllowedBoardDocsPdfUrl(url)) continue

    files.push({
      id,
      name: stripHtml(match[1]).replace(/\s+\([\d,.]+\s+(?:bytes?|KB|MB)\)$/i, '').trim(),
      url,
    })
  }

  return files
}

export async function downloadBoardDocsPdf(url: string) {
  let currentUrl = url

  for (let redirectCount = 0; redirectCount <= 5; redirectCount++) {
    if (!isAllowedBoardDocsPdfUrl(currentUrl)) {
      throw new Error('Rejected BoardDocs attachment URL')
    }

    const response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: { 'User-Agent': 'CivicCycle/1.0 public-agenda-ingestion' },
      signal: AbortSignal.timeout(PDF_DOWNLOAD_TIMEOUT_MS),
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('BoardDocs attachment redirect missing location')
      await response.body?.cancel()
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }

    if (!response.ok) {
      throw new Error(`BoardDocs attachment download failed: ${response.status}`)
    }

    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (contentType !== 'application/pdf') {
      throw new Error(`Rejected BoardDocs attachment MIME type: ${contentType ?? 'missing'}`)
    }

    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_PDF_BYTES) {
      throw new Error(`Rejected BoardDocs attachment larger than ${MAX_PDF_BYTES} bytes`)
    }
    if (!response.body) throw new Error('BoardDocs attachment response had no body')

    const chunks: Uint8Array[] = []
    const reader = response.body.getReader()
    let byteSize = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteSize += value.byteLength
      if (byteSize > MAX_PDF_BYTES) {
        await reader.cancel()
        throw new Error(`Rejected BoardDocs attachment larger than ${MAX_PDF_BYTES} bytes`)
      }
      chunks.push(value)
    }

    return { buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))), byteSize }
  }

  throw new Error('BoardDocs attachment exceeded redirect limit')
}

export async function processBoardDocsPdf(file: BoardDocsPublicFile): Promise<ProcessedBoardDocsDocument> {
  let byteSize: number | null = null
  let checksumSha256: string | null = null
  try {
    const download = await downloadBoardDocsPdf(file.url)
    byteSize = download.byteSize
    checksumSha256 = createHash('sha256').update(download.buffer).digest('hex')
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(download.buffer) })

    try {
      const info = await parser.getInfo()
      if (info.total > MAX_PDF_PAGES) {
        throw new Error(`Rejected PDF with ${info.total} pages; limit is ${MAX_PDF_PAGES}`)
      }
      const result = await parser.getText({ parseHyperlinks: true, pageJoiner: '' })
      return {
        ...file,
        checksumSha256,
        parserName: 'pdf-parse',
        parserVersion: '2.4.5',
        markdown: normalizePdfPages(result.pages.map((page) => ({ page: page.num, text: page.text }))),
        pageCount: result.total,
        byteSize,
        status: 'extracted',
        error: null,
      }
    } finally {
      await parser.destroy()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PDF extraction error'
    return {
      ...file,
      checksumSha256,
      parserName: 'pdf-parse',
      parserVersion: '2.4.5',
      markdown: null,
      pageCount: null,
      byteSize,
      status: message.startsWith('Rejected') ? 'rejected' : 'failed',
      error: message,
    }
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
) {
  const results: R[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++
      results[index] = await mapper(values[index])
    }
  })
  await Promise.all(workers)
  return results
}

// Backward-compatible helper; strict BoardDocs URL and PDF bounds now apply.
export async function extractPdfText(url: string): Promise<string> {
  const processed = await processBoardDocsPdf({ id: 'direct', name: 'attachment.pdf', url })
  if (!processed.markdown) throw new Error(processed.error ?? 'PDF extraction failed')
  return processed.markdown
}

// Main: Get complete meeting content ready for summarization
export async function getMeetingContent(
  meetingId: string,
  districtId: SchoolDistrictId = DEFAULT_SCHOOL_DISTRICT_ID,
  options: { includeAttachments?: boolean } = {}
): Promise<MeetingContentResult> {
  // Get the meeting info from the meetings list
  const meetings = await listMeetings(districtId)
  const meeting = meetings.find((m) => m.id === meetingId)
  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found`)
  }

  // Get agenda items
  const agendaItems = await getMeetingAgenda(meetingId, districtId)

  const ingestedItems: IngestedAgendaItem[] = []

  for (const item of agendaItems) {
    try {
      const content = await getAgendaItemContent(item.id, districtId)
      const files = options.includeAttachments
        ? await getAgendaItemPublicFiles(item.id, districtId)
        : []
      ingestedItems.push({
        agenda: item,
        content,
        documents: files.map((file) => ({
          ...file,
          checksumSha256: null,
          parserName: 'pdf-parse',
          parserVersion: '2.4.5',
          markdown: null,
          pageCount: null,
          byteSize: null,
          status: 'failed',
          error: 'Attachment processing not started',
        })),
      })
    } catch (err) {
      console.error(`Failed to fetch agenda item ${item.id} (${item.name}):`, err)
    }
  }

  if (options.includeAttachments) {
    const jobs = ingestedItems.flatMap((item, itemIndex) =>
      item.documents.map((document, documentIndex) => ({ itemIndex, documentIndex, document }))
    )
    const processed = await mapWithConcurrency(jobs, ATTACHMENT_PARSE_CONCURRENCY, async (job) => ({
      ...job,
      result: await processBoardDocsPdf(job.document),
    }))
    for (const job of processed) {
      ingestedItems[job.itemIndex].documents[job.documentIndex] = job.result
    }
  }

  const sections = ingestedItems.map(({ agenda: item, content, documents }) => {
    let section = `## ${item.order} ${content.name}\n`
    if (content.category) section += `Category: ${content.category}\n`
    if (content.type) section += `Type: ${content.type}\n`
    if (content.recommendedAction) section += `Recommended Action: ${content.recommendedAction}\n`
    if (content.bodyMarkdown) section += `\n${content.bodyMarkdown}\n`
    if (content.motions.length > 0) {
      section += `\n### Motions & Voting\n${content.motions.map((motion) => `- ${motion}`).join('\n')}\n`
    }
    for (const document of documents) {
      if (document.markdown) {
        section += `\n### Attachment: ${document.name}\n\n${document.markdown}\n`
      }
    }
    return section
  })

  const header = `# ${meeting.name}\nDate: ${meeting.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`
  const fullText = header + sections.join('\n---\n\n')

  return {
    title: meeting.name,
    date: meeting.date,
    fullText,
    itemCount: ingestedItems.length,
    documentCount: ingestedItems.reduce((count, item) => count + item.documents.length, 0),
    agendaItems: ingestedItems,
  }
}

// Get the public URL for a BoardDocs meeting item
export function getBoardDocsUrl(
  itemId: string,
  districtId: SchoolDistrictId = DEFAULT_SCHOOL_DISTRICT_ID
): string {
  return getSchoolDistrict(districtId).sourceUrl(itemId)
}
