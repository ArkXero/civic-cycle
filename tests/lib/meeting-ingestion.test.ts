import { describe, expect, it } from 'vite-plus/test'
import { parseBoardDocsMotions } from '@/lib/boarddocs'
import { motionRowsForPersistence, selectCurrentMeetingDocuments } from '@/lib/meeting-ingestion'

describe('meeting ingestion', () => {
  it('keeps only the newest attachment version per external file ID', () => {
    const documents = [
      { id: 'old', external_file_id: 'budget', created_at: '2026-08-01T00:00:00Z', markdown: 'old' },
      { id: 'other', external_file_id: 'minutes', created_at: '2026-08-02T00:00:00Z', markdown: 'minutes' },
      { id: 'new', external_file_id: 'budget', created_at: '2026-08-03T00:00:00Z', markdown: 'new' },
    ]

    expect(selectCurrentMeetingDocuments(documents)).toEqual([
      documents[2],
      documents[1],
    ])
  })

  it('uses the row ID as a deterministic tie-breaker', () => {
    const documents = [
      { id: 'a', external_file_id: 'budget', created_at: '2026-08-03T00:00:00Z' },
      { id: 'b', external_file_id: 'budget', created_at: '2026-08-03T00:00:00Z' },
    ]

    expect(selectCurrentMeetingDocuments(documents)).toEqual([documents[1]])
  })

  it('maps nullable official motion facts without synthesizing vote counts', () => {
    const [motion] = parseBoardDocsMotions(
      '<div class="motion"><div>Main Motion: Adopt policy.</div><div>Final Resolution: Motion Carries</div></div>'
    )
    const [row] = motionRowsForPersistence({
      agenda: {
        id: 'agenda-1',
        name: 'Policy',
        order: '7.01',
        category: 'Action',
        type: 'Action',
        hasAttachment: false,
      },
      content: {
        id: 'agenda-1',
        name: 'Policy',
        category: 'Action',
        type: 'Action',
        recommendedAction: '',
        bodyHtml: '',
        bodyText: '',
        bodyMarkdown: '',
        motions: [motion],
      },
      documents: [],
    })

    expect(row).toMatchObject({
      source_ordinal: 0,
      content_hash: motion.contentHash,
      normalized_motion_text: 'Adopt policy.',
      motion_type: 'main',
      outcome: 'passed',
      vote_yes: null,
      vote_no: null,
      vote_abstain: null,
      parser_version: 'boarddocs-motion-v2',
    })
  })
})
