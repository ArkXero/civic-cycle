import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { KeyDecision } from '@/types'

interface KeyDecisionsProps {
  decisions: KeyDecision[]
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
          {decisions.map((decision, index) => (
            <li key={index} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <p className="font-medium text-foreground mb-2">{decision.decision}</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {decision.vote_yes} Yes
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-4 w-4" />
                  {decision.vote_no} No
                </span>
                {decision.vote_abstain > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MinusCircle className="h-4 w-4" />
                    {decision.vote_abstain} Abstain
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
