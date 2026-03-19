const BOARDDOCS_STATE = process.env.BOARDDOCS_STATE || 'vsba'
const BOARDDOCS_DISTRICT = process.env.BOARDDOCS_DISTRICT || 'fairfax'
const BOARDDOCS_BASE = `https://go.boarddocs.com/${BOARDDOCS_STATE}/${BOARDDOCS_DISTRICT}/Board.nsf`

// The Fairfax County School Board committee ID (from the BoardDocs site)
const COMMITTEE_ID = 'A9HDX937D70D'

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
}

export interface AgendaItemContent {
  id: string
  name: string
  category: string
  type: string
  recommendedAction: string
  bodyHtml: string
  bodyText: string
  motions: string[]
}

// POST helper for BoardDocs API
async function boardDocsPost(endpoint: string, data: Record<string, string> = {}): Promise<string> {
  const body = new URLSearchParams({
    current_committee_id: COMMITTEE_ID,
    ...data,
  })

  const res = await fetch(`${BOARDDOCS_BASE}/${endpoint}?open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0',
    },
    body,
  })

  if (!res.ok) {
    throw new Error(`BoardDocs API error: ${res.status} ${res.statusText}`)
  }

  return res.text()
}

// Fetch list of all public meetings
export async function listMeetings(): Promise<BoardDocsMeeting[]> {
  const text = await boardDocsPost('BD-GetMeetingsList')

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
export async function getMeetingAgenda(meetingId: string): Promise<AgendaItem[]> {
  const html = await boardDocsPost('BD-GetAgenda', { id: meetingId })

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
    })

    currentCategory = closestCategory || currentCategory
  }

  return items
}

// Fetch full content for a single agenda item
export async function getAgendaItemContent(itemId: string): Promise<AgendaItemContent> {
  const html = await boardDocsPost('BD-GetAgendaItem', { id: itemId })

  // Extract fields from the HTML
  const name = extractField(html, 'Subject') || extractField(html, 'ai-name') || ''
  const category = extractField(html, 'Category') || ''
  const type = extractField(html, 'Type') || ''
  const recommendedAction = extractField(html, 'Recommended Action') || ''

  // Extract the main body content
  const bodyMatch = html.match(/key="publicbody"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)
  const bodyHtml = bodyMatch ? bodyMatch[1] : ''
  const bodyText = stripHtml(bodyHtml)

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

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

// Extract text from a PDF URL
export async function extractPdfText(url: string): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  const result = await parser.getText()
  return result.text
}

// Main: Get complete meeting content ready for summarization
export async function getMeetingContent(meetingId: string): Promise<{
  title: string
  date: Date
  fullText: string
  itemCount: number
}> {
  // Get the meeting info from the meetings list
  const meetings = await listMeetings()
  const meeting = meetings.find((m) => m.id === meetingId)
  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found`)
  }

  // Get agenda items
  const agendaItems = await getMeetingAgenda(meetingId)

  // Fetch content for each agenda item
  const sections: string[] = []
  let processedCount = 0

  for (const item of agendaItems) {
    try {
      const content = await getAgendaItemContent(item.id)

      let section = `## ${item.order} ${content.name}\n`
      if (content.category) {
        section += `Category: ${content.category}\n`
      }
      if (content.type) {
        section += `Type: ${content.type}\n`
      }
      if (content.recommendedAction) {
        section += `Recommended Action: ${content.recommendedAction}\n`
      }
      section += '\n'

      if (content.bodyText) {
        section += content.bodyText + '\n'
      }

      if (content.motions.length > 0) {
        section += '\nMotions & Voting:\n'
        for (const motion of content.motions) {
          section += `- ${motion}\n`
        }
      }

      sections.push(section)
      processedCount++
    } catch (err) {
      console.error(`Failed to fetch agenda item ${item.id} (${item.name}):`, err)
    }
  }

  const header = `# ${meeting.name}\nDate: ${meeting.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`
  const fullText = header + sections.join('\n---\n\n')

  return {
    title: meeting.name,
    date: meeting.date,
    fullText,
    itemCount: processedCount,
  }
}

// Get the public URL for a BoardDocs meeting item
export function getBoardDocsUrl(itemId: string): string {
  return `${BOARDDOCS_BASE}/goto?open&id=${itemId}`
}
