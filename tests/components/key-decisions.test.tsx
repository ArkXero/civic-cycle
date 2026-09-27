import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'
import { KeyDecisions } from '@/components/meetings/key-decisions'

describe('KeyDecisions', () => {
  it('uses the decision wording instead of marking a zero-zero tally failed', () => {
    const html = renderToStaticMarkup(
      <KeyDecisions decisions={[{
        decision: 'Approved the consent agenda',
        vote_yes: 0,
        vote_no: 0,
        vote_abstain: null,
      }]} />
    )

    expect(html).toContain('Passed')
    expect(html).not.toContain('Failed')
  })
})
