import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { KeyDecision } from '@/types'

interface KeyDecisionsProps {
  decisions: KeyDecision[]
}

type Outcome = 'passed' | 'failed' | 'unknown'

function getOutcome(decision: KeyDecision): Outcome {
  if (decision.vote_yes > 0 || decision.vote_no > 0) {
    return decision.vote_yes > decision.vote_no ? 'passed' : 'failed'
  }
  // Fallback for existing data without vote counts: infer from action verb
  const text = decision.decision.toLowerCase()
  if (/^(approved|accepted|directed|authorized|adopted|enacted|established|elected|appointed|passed|granted|confirmed|ratified|awarded)/.test(text)) {
    return 'passed'
  }
  if (/^(denied|rejected|failed|tabled|withdrawn|defeated|refused)/.test(text)) {
    return 'failed'
  }
  return 'unknown'
}

export function KeyDecisions({ decisions }: KeyDecisionsProps) {
  if (!decisions || decisions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Key Decisions</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {decisions.map((decision, index) => {
            const outcome = getOutcome(decision)
            const hasVoteCounts = decision.vote_yes > 0 || decision.vote_no > 0

            return (
              <li key={index} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <p className="font-medium text-foreground mb-2">{decision.decision}</p>
                <div className="flex items-center gap-3 text-sm">
                  {outcome === 'passed' && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium bg-green-500/15 text-green-600 ring-1 ring-green-500/30">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Passed
                    </span>
                  )}
                  {outcome === 'failed' && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium bg-red-500/15 text-red-600 ring-1 ring-red-500/30">
                      <XCircle className="h-3.5 w-3.5" />
                      Failed
                    </span>
                  )}
                  {hasVoteCounts && (
                    <span className="text-muted-foreground">
                      {decision.vote_yes}–{decision.vote_no}
                      {decision.vote_abstain > 0 && (
                        <span className="ml-1 inline-flex items-center gap-1">
                          <MinusCircle className="h-3 w-3" />
                          {decision.vote_abstain}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
