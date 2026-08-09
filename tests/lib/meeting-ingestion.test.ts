import { describe, expect, it } from 'vite-plus/test'
import { selectCurrentMeetingDocuments } from '@/lib/meeting-ingestion'

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
})
