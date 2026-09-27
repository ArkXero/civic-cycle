import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { extractBalancedDivBlocks, hashBoardDocsContent, parseBoardDocsMotions } from '@/lib/boarddocs'

function fixture(name: string) {
  return readFileSync(join(process.cwd(), 'tests/fixtures/boarddocs', name), 'utf8')
}

describe('BoardDocs motion parser', () => {
  it('extracts nested motion divs without truncating vote records', () => {
    const html = fixture('fairfax-2026-07-16-7.04-motions.html')
    const blocks = extractBalancedDivBlocks(html, (classes) => classes.includes('motion'))

    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toContain('Final Resolution: Motion Fails')
    expect(blocks[0]).toContain('No: Sandy B Anderson')
    expect(blocks[1]).toContain('Yes: Sandy B Anderson')
  })

  it('preserves Fairfax chronology, failed amendment, people, and exact roll call', () => {
    const motions = parseBoardDocsMotions(fixture('fairfax-2026-07-16-7.04-motions.html'))

    expect(motions.map((motion) => motion.sourceOrdinal)).toEqual([0, 1])
    expect(motions[0]).toMatchObject({
      motionType: 'amendment',
      outcome: 'failed',
      mover: 'Ilryong Moon',
      seconder: 'Seema Dixit',
      voteYes: 4,
      voteNo: 7,
      voteAbstain: null,
    })
    expect(motions[0].rollCallNo).toContain('Robyn Lady - Chair')
    expect(motions[1]).toMatchObject({
      motionType: 'main',
      outcome: 'passed',
      voteYes: 11,
      isFinal: true,
    })
    expect(motions[0].rawHtml).toContain('<div class="motion finalresolution">')
    expect(motions[0].contentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('links amendment-to-amendment and final amended wording without guessing', () => {
    const motions = parseBoardDocsMotions(
      fixture('fairfax-2026-07-16-7.07-amendment-chain.html')
    )

    expect(motions.map((motion) => motion.motionType)).toEqual([
      'original',
      'amendment',
      'amendment_to_amendment',
      'amended_amendment',
      'amended_final',
    ])
    expect(motions[1].parentOrdinal).toBe(0)
    expect(motions[2].parentOrdinal).toBe(1)
    expect(motions[3].parentOrdinal).toBe(1)
    expect(motions[4].parentOrdinal).toBe(0)
    expect(motions[0].isSuperseded).toBe(true)
    expect(motions[1].isSuperseded).toBe(true)
    expect(motions[4]).toMatchObject({
      isFinal: true,
      outcome: 'passed',
      voteYes: 9,
      voteNo: 1,
      voteAbstain: 1,
    })
    expect(motions[4].normalizedText).toContain('until a formal policy is adopted')
  })

  it.each([
    ['I move to postpone this agenda item until August 27, 2026.\n\nThis was approved with unanimous consent.', 'postponed', 'passed'],
    ['I move to table this motion.\n\nFinal Resolution: Motion Tabled', 'tabled', 'tabled'],
    ['The motion was withdrawn by its maker.', 'withdrawn', 'withdrawn'],
  ] as const)('keeps procedural outcome and nullable voice-vote tally: %s', (text, type, outcome) => {
    const motions = parseBoardDocsMotions(`<div class="motion"><div>${text}</div></div>`)

    expect(motions[0]).toMatchObject({
      motionType: type,
      outcome,
      voteYes: null,
      voteNo: null,
      voteAbstain: null,
    })
  })

  it('does not treat a procedural proposal as an official result without a resolution', () => {
    const [motion] = parseBoardDocsMotions(
      '<div class="motion"><div>I move to postpone this agenda item until August 27, 2026.</div></div>'
    )

    expect(motion).toMatchObject({
      motionType: 'postponed',
      outcome: 'unknown',
    })
  })

  it('includes the motion parser version in the refresh hash', () => {
    const agendaItem = {
      agenda: { id: 'agenda-1', order: '1', name: 'Item', category: '', type: '', hasAttachment: false },
      content: {
        id: 'agenda-1', name: 'Item', category: '', type: '', recommendedAction: '',
        bodyHtml: '', bodyText: '', bodyMarkdown: '', motions: [{ contentHash: 'a'.repeat(64), parserVersion: 'v1' }],
      },
      documents: [],
    }
    const changedParser = {
      ...agendaItem,
      content: {
        ...agendaItem.content,
        motions: [{ contentHash: 'a'.repeat(64), parserVersion: 'v2' }],
      },
    }

    expect(hashBoardDocsContent('Meeting', new Date('2026-08-20T12:00:00.000Z'), [agendaItem] as never))
      .not.toBe(hashBoardDocsContent('Meeting', new Date('2026-08-20T12:00:00.000Z'), [changedParser] as never))
  })

  it('preserves unknown markup and does not infer facts', () => {
    const html = '<div class="motion strange"><custom-vote result="maybe">Unrecognized source</custom-vote></div>'
    const [motion] = parseBoardDocsMotions(html)

    expect(motion).toMatchObject({
      rawHtml: html,
      rawText: 'Unrecognized source',
      motionType: 'other',
      outcome: 'unknown',
      parentOrdinal: null,
      voteYes: null,
      voteNo: null,
    })
  })
})
