import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  getAgendaItemPublicFiles,
  isAllowedBoardDocsPdfUrl,
  processBoardDocsPdf,
} from '@/lib/boarddocs'

afterEach(() => vi.unstubAllGlobals())

describe('BoardDocs attachments', () => {
  it('allows only HTTPS BoardDocs pfiles URLs', () => {
    expect(isAllowedBoardDocsPdfUrl('https://go.boarddocs.com/vsba/fairfax/Board.nsf/pfiles/ABC/$file/report.pdf')).toBe(true)
    expect(isAllowedBoardDocsPdfUrl('http://go.boarddocs.com/vsba/fairfax/Board.nsf/pfiles/ABC/$file/report.pdf')).toBe(false)
    expect(isAllowedBoardDocsPdfUrl('https://evil.example/vsba/fairfax/Board.nsf/pfiles/ABC/$file/report.pdf')).toBe(false)
    expect(isAllowedBoardDocsPdfUrl('https://go.boarddocs.com/vsba/fairfax/Board.nsf/Public/report.pdf')).toBe(false)
  })

  it('parses public-file anchors and ignores unsafe links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`
      <a class="public-file" unique="FILE1" href="/vsba/fairfax/Board.nsf/pfiles/FILE1/$file/Budget.pdf">Budget.pdf (335 KB)</a>
      <a class="public-file" unique="FILE2" href="https://evil.example/report.pdf">Bad.pdf</a>
    `, { status: 200 })))

    await expect(getAgendaItemPublicFiles('ITEM1', 'fairfax')).resolves.toEqual([{
      id: 'FILE1',
      name: 'Budget.pdf',
      url: 'https://go.boarddocs.com/vsba/fairfax/Board.nsf/pfiles/FILE1/$file/Budget.pdf',
    }])
  })

  it('rejects non-PDF MIME types before parsing content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not a pdf', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })))

    const result = await processBoardDocsPdf({
      id: 'FILE1',
      name: 'Budget.pdf',
      url: 'https://go.boarddocs.com/vsba/fairfax/Board.nsf/pfiles/FILE1/$file/Budget.pdf',
    })
    expect(result.status).toBe('rejected')
    expect(result.error).toContain('MIME type')
  })

  it('rejects declared files above the 20 MB limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('small body', {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(20 * 1024 * 1024 + 1),
      },
    })))

    const result = await processBoardDocsPdf({
      id: 'FILE1',
      name: 'Budget.pdf',
      url: 'https://go.boarddocs.com/vsba/fairfax/Board.nsf/pfiles/FILE1/$file/Budget.pdf',
    })
    expect(result.status).toBe('rejected')
    expect(result.error).toContain('larger than')
  })

  it('keeps checksum when downloaded PDF fails during parsing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not a valid pdf', {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    })))

    const result = await processBoardDocsPdf({
      id: 'FILE1',
      name: 'Budget.pdf',
      url: 'https://go.boarddocs.com/vsba/fairfax/Board.nsf/pfiles/FILE1/$file/Budget.pdf',
    })
    expect(result.status).toBe('failed')
    expect(result.checksumSha256).toMatch(/^[0-9a-f]{64}$/)
  })
})
