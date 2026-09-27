import { notFound } from 'next/navigation'
import { MotionTimeline } from '@/components/meetings/motion-timeline'
import { getBoardDocsUrl } from '@/lib/boarddocs'
import type { MotionTimelineItem } from '@/lib/data/motions'

const shared = {
  meeting_id: '670d9612-dbd0-48c8-801d-34752033af0e',
  agenda_item_id: 'DVUVEY807630',
  agenda_item_order: '7.07',
  agenda_item_title: 'Educational Technology Motions',
  raw_html: '',
  parser_version: 'boarddocs-motion-v2',
  created_at: '2026-07-16T00:00:00.000Z',
  updated_at: '2026-07-16T00:00:00.000Z',
}

const motions: MotionTimelineItem[] = [
  {
    ...shared,
    id: 'motion-4',
    source_ordinal: 4,
    content_hash: '3ed256823bc3',
    raw_motion_text: 'Original main motion #3',
    normalized_motion_text:
      'I move the Fairfax County School Board to direct the Superintendent to provide a comprehensive inventory of Generative Artificial Intelligence tools and solutions provided by or through FCPS on FCPS-issued laptops and tablets by November 12, 2026, and to prohibit the use of such Generative AI tools and solutions by students until a formal policy is adopted by the School Board to govern such usage.',
    motion_type: 'original',
    parent_ordinal: null,
    is_final: false,
    is_superseded: true,
    outcome: 'unknown',
    vote_yes: null,
    vote_no: null,
    vote_abstain: null,
    mover: 'Mateo Dunne',
    seconder: 'Ricardy J Anderson',
    roll_call_yes: [],
    roll_call_no: [],
    roll_call_abstain: [],
  },
  {
    ...shared,
    id: 'motion-5',
    source_ordinal: 5,
    content_hash: '16a52a435701',
    raw_motion_text: 'Amendment to main motion #3',
    normalized_motion_text:
      'I move to amend main motion #3 by striking the motion in its entirety and inserting in its place: I move that the Fairfax County School Board direct the Superintendent to provide a comprehensive inventory of Generative Artificial Intelligence tools and solutions (AS DEFINED BY FCPS) provided by or through FCPS on FCPS-issued laptops and tablets by JANUARY 14, 2027, and to prohibit the use of such Generative AI tools and solutions by ELEMENTARY SCHOOL students unless specifically authorized in writing by a School Principal or the Superintendent (or their designee) for specialized student projects or particular uses, until a formal policy is adopted by the School Board to govern such usage.',
    motion_type: 'amendment',
    parent_ordinal: 4,
    is_final: false,
    is_superseded: true,
    outcome: 'unknown',
    vote_yes: null,
    vote_no: null,
    vote_abstain: null,
    mover: 'Sandy B Anderson',
    seconder: 'Robyn Lady - Chair',
    roll_call_yes: [],
    roll_call_no: [],
    roll_call_abstain: [],
  },
  {
    ...shared,
    id: 'motion-6',
    source_ordinal: 6,
    content_hash: '87c563f0591f',
    raw_motion_text: 'Amendment to amendment to main motion #3',
    normalized_motion_text:
      'Amendment to Amendment to Main Motion #3: I move to amend the amendment to main motion #3 by inserting the phrase “, and will only be permissible for secondary students” after the phrase “elementary school students” and before the phrase “unless specifically authorized in writing”.',
    motion_type: 'amendment_to_amendment',
    parent_ordinal: 5,
    is_final: false,
    is_superseded: false,
    outcome: 'passed',
    vote_yes: 10,
    vote_no: 1,
    vote_abstain: null,
    mover: 'Karl V Frisch',
    seconder: 'Mateo Dunne',
    roll_call_yes: [
      'Sandy B Anderson',
      'Karl V Frisch',
      'Ilryong Moon',
      'Kyle McDaniel - Vice Chair',
      'Robyn Lady - Chair',
      'Seema Dixit',
      'Mateo Dunne',
      'Tom Dannan',
      'Ricardy J Anderson',
      'Marcia St John-Cunning',
    ],
    roll_call_no: ['Melanie K Meren'],
    roll_call_abstain: [],
  },
  {
    ...shared,
    id: 'motion-7',
    source_ordinal: 7,
    content_hash: '34c8c8b760a4',
    raw_motion_text: 'Amended amendment to main motion #3',
    normalized_motion_text:
      'I move that the Fairfax County School Board direct the Superintendent to provide a comprehensive inventory of Generative Artificial Intelligence tools and solutions (AS DEFINED BY FCPS) provided by or through FCPS on FCPS-issued laptops and tablets by JANUARY 14, 2027, and to prohibit the use of such Generative AI tools and solutions by ELEMENTARY SCHOOL students, and will only be permissible for secondary students unless specifically authorized in writing by a School Principal or the Superintendent (or their designee) for specialized student projects or particular uses, until a formal policy is adopted by the School Board to govern such usage.',
    motion_type: 'amended_amendment',
    parent_ordinal: 5,
    is_final: true,
    is_superseded: false,
    outcome: 'passed',
    vote_yes: 9,
    vote_no: 2,
    vote_abstain: null,
    mover: 'Sandy B Anderson',
    seconder: 'Robyn Lady - Chair',
    roll_call_yes: [
      'Sandy B Anderson',
      'Karl V Frisch',
      'Kyle McDaniel - Vice Chair',
      'Robyn Lady - Chair',
      'Seema Dixit',
      'Mateo Dunne',
      'Tom Dannan',
      'Ricardy J Anderson',
      'Marcia St John-Cunning',
    ],
    roll_call_no: ['Melanie K Meren', 'Ilryong Moon'],
    roll_call_abstain: [],
  },
  {
    ...shared,
    id: 'motion-8',
    source_ordinal: 8,
    content_hash: '626500189341',
    raw_motion_text: 'Amended main motion #3',
    normalized_motion_text:
      'I move that the Fairfax County School Board direct the Superintendent to provide a comprehensive inventory of Generative Artificial Intelligence tools and solutions (AS DEFINED BY FCPS) provided by or through FCPS on FCPS-issued laptops and tablets by JANUARY 14, 2027, and to prohibit the use of such Generative AI tools and solutions by ELEMENTARY SCHOOL students, and will only be permissible for secondary students unless specifically authorized in writing by a School Principal or the Superintendent (or their designee) for specialized student projects or particular uses, until a formal policy is adopted by the School Board to govern such usage.',
    motion_type: 'amended_final',
    parent_ordinal: 4,
    is_final: true,
    is_superseded: false,
    outcome: 'passed',
    vote_yes: 9,
    vote_no: 1,
    vote_abstain: 1,
    mover: 'Mateo Dunne',
    seconder: 'Ricardy J Anderson',
    roll_call_yes: [
      'Sandy B Anderson',
      'Karl V Frisch',
      'Kyle McDaniel - Vice Chair',
      'Robyn Lady - Chair',
      'Seema Dixit',
      'Mateo Dunne',
      'Tom Dannan',
      'Ricardy J Anderson',
      'Marcia St John-Cunning',
    ],
    roll_call_no: ['Ilryong Moon'],
    roll_call_abstain: ['Melanie K Meren'],
  },
]

export default function MotionPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()

  return (
    <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Development preview · July 16, 2026 BoardDocs record
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Amendment-aware motion timeline</h1>
        <p className="mt-2 text-muted-foreground">
          Original motion through final operative wording, preserving official source order.
        </p>
      </div>
      <MotionTimeline
        motions={motions}
        legacyDecisions={[]}
        boardDocsUrl={getBoardDocsUrl('DJWQR669AFD3', 'fairfax')}
      />
    </main>
  )
}
