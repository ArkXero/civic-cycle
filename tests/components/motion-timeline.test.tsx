import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'
import { MotionTimeline } from '@/components/meetings/motion-timeline'
import type { MotionTimelineItem } from '@/lib/data/motions'

const motion: MotionTimelineItem = {
  id: 'motion-1',
  meeting_id: 'meeting-1',
  agenda_item_id: 'agenda-1',
  agenda_item_order: '7.07',
  agenda_item_title: 'Educational Technology Motions',
  source_ordinal: 4,
  content_hash: 'a'.repeat(64),
  raw_html: '<div class="motion">Motion</div>',
  raw_motion_text: 'Amended Main Motion: Adopt final policy',
  normalized_motion_text: 'Adopt final policy',
  motion_type: 'amended_final',
  parent_ordinal: 0,
  is_final: true,
  is_superseded: false,
  outcome: 'passed',
  vote_yes: 9,
  vote_no: 1,
  vote_abstain: 1,
  mover: 'Mateo Dunne',
  seconder: 'Ricardy J Anderson',
  roll_call_yes: ['Member One', 'Member Two'],
  roll_call_no: ['Member Three'],
  roll_call_abstain: ['Member Four'],
  parser_version: 'boarddocs-motion-v2',
  created_at: '2026-08-20T00:00:00.000Z',
  updated_at: '2026-08-20T00:00:00.000Z',
}

describe('MotionTimeline', () => {
  it('renders responsive official chronology, final marker, tally, people, and roll call', () => {
    const html = renderToStaticMarkup(
      <MotionTimeline
        motions={[motion]}
        legacyDecisions={[]}
        boardDocsUrl="https://go.boarddocs.com/vsba/fairfax/Board.nsf/goto?open&id=ITEM"
      />
    )

    expect(html).toContain('<ol')
    expect(html).toContain('Final amended motion')
    expect(html).toContain('Final operative wording')
    expect(html).toContain('9 yes · 1 no · 1 abstain')
    expect(html).toContain('Moved by Mateo Dunne')
    expect(html).toContain('<details')
    expect(html).toContain('Member Three')
    expect(html).toContain('sm:flex-row')
    expect(html).toContain('BoardDocs source')
  })

  it('renders legacy fallback without inventing missing vote counts', () => {
    const html = renderToStaticMarkup(
      <MotionTimeline
        motions={[]}
        legacyDecisions={[{
          decision: 'Approved prior policy',
          vote_yes: null,
          vote_no: null,
          vote_abstain: null,
        }]}
      />
    )

    expect(html).toContain('Legacy summary data')
    expect(html).toContain('Approved prior policy')
    expect(html).not.toContain('0–0')
  })

  it('renders empty, loading, and error states', () => {
    const empty = renderToStaticMarkup(<MotionTimeline motions={[]} legacyDecisions={[]} />)
    const loading = renderToStaticMarkup(<MotionTimeline motions={[]} legacyDecisions={[]} loading />)
    const error = renderToStaticMarkup(
      <MotionTimeline motions={[]} legacyDecisions={[]} error="Motion query failed" />
    )

    expect(empty).toContain('No post-meeting motion results')
    expect(loading).toContain('aria-busy="true"')
    expect(error).toContain('role="alert"')
    expect(error).toContain('Motion query failed')
  })
})
