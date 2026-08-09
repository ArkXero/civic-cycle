export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const MAX_PDF_PAGES = 200
export const PDF_DOWNLOAD_TIMEOUT_MS = 30_000

export interface SourcePage {
  page: number
  text: string
}

export interface MarkdownChunk {
  text: string
  startPage: number | null
  endPage: number | null
  estimatedTokens: number
}

function canonicalLine(line: string) {
  return line.replace(/\s+/g, ' ').trim()
}

function repeatedEdgeLines(pages: SourcePage[]) {
  const counts = new Map<string, number>()

  for (const page of pages) {
    const lines = page.text
      .split(/\r?\n/)
      .map(canonicalLine)
      .filter(Boolean)
    const candidates = new Set([...lines.slice(0, 3), ...lines.slice(-3)])
    for (const line of candidates) {
      if (line.length < 3 || line.length > 160) continue
      counts.set(line, (counts.get(line) ?? 0) + 1)
    }
  }

  const minimumOccurrences = Math.max(2, Math.ceil(pages.length * 0.6))
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= minimumOccurrences)
      .map(([line]) => line)
  )
}

function normalizePageText(text: string, repeatedLines: Set<string>) {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00ad/g, '')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trimEnd())
    .filter((line) => !repeatedLines.has(canonicalLine(line)))

  const joined: string[] = []
  for (const line of lines) {
    const previous = joined.at(-1)
    if (
      previous &&
      /[a-z]-$/.test(previous) &&
      /^[a-z]/.test(line.trimStart())
    ) {
      joined[joined.length - 1] = `${previous.slice(0, -1)}${line.trimStart()}`
    } else {
      joined.push(line)
    }
  }

  return joined
    .join('\n')
    .replace(/^\s*[•●▪◦]\s+/gm, '- ')
    .replace(/\n[ \t]+\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizePdfPages(pages: SourcePage[]) {
  const validPages = pages
    .filter((page) => Number.isInteger(page.page) && page.page > 0)
    .sort((a, b) => a.page - b.page)
  const repeatedLines = repeatedEdgeLines(validPages)

  return validPages
    .map((page) => {
      const text = normalizePageText(page.text, repeatedLines)
      return `<!-- page:${page.page} -->${text ? `\n\n${text}` : '\n\n_[Empty page]_'}`
    })
    .join('\n\n')
    .trim()
}

export function normalizeAgendaMarkdown(markdown: string) {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function canonicalEvidenceText(text: string) {
  return text.replace(/<!--\s*page:\d+\s*-->/g, ' ').replace(/\s+/g, ' ').trim()
}

export function evidenceExistsInSource(sourceMarkdown: string, quote: string) {
  const normalizedQuote = canonicalEvidenceText(quote)
  if (!normalizedQuote) return false
  return canonicalEvidenceText(sourceMarkdown).includes(normalizedQuote)
}

export function findEvidencePage(sourceMarkdown: string, quote: string) {
  const normalizedQuote = canonicalEvidenceText(quote)
  if (!normalizedQuote) return null

  const markers = [...sourceMarkdown.matchAll(/<!--\s*page:(\d+)\s*-->/g)]
  for (let index = 0; index < markers.length; index++) {
    const marker = markers[index]
    const start = (marker.index ?? 0) + marker[0].length
    const end = markers[index + 1]?.index ?? sourceMarkdown.length
    if (canonicalEvidenceText(sourceMarkdown.slice(start, end)).includes(normalizedQuote)) {
      return Number(marker[1])
    }
  }
  return null
}

function pageRange(text: string) {
  const pages = [...text.matchAll(/<!--\s*page:(\d+)\s*-->/g)].map((match) => Number(match[1]))
  return {
    startPage: pages.length ? Math.min(...pages) : null,
    endPage: pages.length ? Math.max(...pages) : null,
  }
}

function takeOverlap(text: string, overlapTokens: number) {
  const targetCharacters = overlapTokens * 4
  if (text.length <= targetCharacters) return text
  const tail = text.slice(-targetCharacters)
  const paragraphBoundary = tail.indexOf('\n\n')
  return paragraphBoundary >= 0 ? tail.slice(paragraphBoundary + 2) : tail
}

export function splitMarkdownByHeadings(
  markdown: string,
  maxTokens = 1_500,
  overlapTokens = 150
): MarkdownChunk[] {
  if (maxTokens <= overlapTokens || overlapTokens < 0) {
    throw new Error('Chunk size must be greater than non-negative overlap')
  }

  const sections = normalizeAgendaMarkdown(markdown).split(/(?=^#{1,6}\s)/m).filter(Boolean)
  const chunks: string[] = []
  let current = ''

  for (const section of sections) {
    const paragraphs = section.split(/\n\n+/)
    for (const paragraph of paragraphs) {
      const candidate = current ? `${current}\n\n${paragraph}` : paragraph
      if (Math.ceil(candidate.length / 4) <= maxTokens) {
        current = candidate
        continue
      }

      if (current) chunks.push(current.trim())
      const overlap = current ? takeOverlap(current, overlapTokens) : ''
      current = overlap ? `${overlap}\n\n${paragraph}` : paragraph

      while (Math.ceil(current.length / 4) > maxTokens) {
        const hardLimit = maxTokens * 4
        chunks.push(current.slice(0, hardLimit).trim())
        current = `${takeOverlap(current.slice(0, hardLimit), overlapTokens)}\n\n${current.slice(hardLimit)}`.trim()
      }
    }
  }

  if (current) chunks.push(current.trim())

  return chunks.map((text) => ({
    text,
    ...pageRange(text),
    estimatedTokens: Math.ceil(text.length / 4),
  }))
}
