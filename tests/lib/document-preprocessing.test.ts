import { describe, expect, it } from 'vite-plus/test'
import {
  evidenceExistsInSource,
  findEvidencePage,
  normalizePdfPages,
  splitMarkdownByHeadings,
} from '@/lib/document-preprocessing'

describe('document preprocessing', () => {
  it('removes repeated page edges while preserving page provenance and empty pages', () => {
    const markdown = normalizePdfPages([
      { page: 1, text: 'Board Report\nA long hyphen-\nated sentence.\nPage footer' },
      { page: 2, text: 'Board Report\nBudget table\nPage footer' },
      { page: 3, text: 'Board Report\n\nPage footer' },
    ])

    expect(markdown).not.toContain('Board Report')
    expect(markdown).not.toContain('Page footer')
    expect(markdown).toContain('hyphenated sentence')
    expect(markdown).toContain('<!-- page:2 -->')
    expect(markdown).toContain('_[Empty page]_')
  })

  it('validates evidence with normalized whitespace but rejects invented text', () => {
    const source = '<!-- page:4 -->\n\nThe board approved the fiscal year budget.'
    expect(evidenceExistsInSource(source, 'board approved   the fiscal year budget')).toBe(true)
    expect(evidenceExistsInSource(source, 'board rejected the budget')).toBe(false)
  })

  it('ties evidence to page containing exact normalized quote', () => {
    const source = '<!-- page:1 -->\nFirst page text.\n\n<!-- page:2 -->\nApproved the budget.'
    expect(findEvidencePage(source, 'Approved   the budget.')).toBe(2)
    expect(findEvidencePage(source, 'Invented text')).toBeNull()
  })

  it('splits oversized Markdown into bounded overlapping chunks', () => {
    const markdown = `# Budget\n\n${'funding details '.repeat(700)}\n\n# Transportation\n\n${'bus routes '.repeat(500)}`
    const chunks = splitMarkdownByHeadings(markdown, 300, 30)
    expect(chunks.length).toBeGreaterThan(2)
    expect(chunks.every((chunk) => chunk.estimatedTokens <= 300)).toBe(true)
  })
})
