'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, RefreshCw, Save, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Topic, TopicSuggestion } from '@/types'

interface TaxonomyPayload {
  suggestions: TopicSuggestion[]
  topics: Topic[]
  assignments: AssignmentReview[]
}

interface AssignmentReview {
  agenda_item_id: string
  topic_id: string
  confidence: number
  rationale: string
  evidence: unknown
  topic: Topic | Topic[]
  agenda_item: {
    id: string
    title: string
    item_order: string
    meeting_id: string
  } | Array<{
    id: string
    title: string
    item_order: string
    meeting_id: string
  }>
}

export function TaxonomyAdmin() {
  const [data, setData] = useState<TaxonomyPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/topics/suggestions')
      if (!response.ok) throw new Error('Could not load taxonomy review queue')
      const payload = await response.json() as { data: TaxonomyPayload }
      setData(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load taxonomy review queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading && !data) {
    return <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="animate-spin" /> Loading taxonomy…</div>
  }
  if (error && !data) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-center justify-between gap-4 py-6">
          <p className="text-sm text-destructive" role="alert">{error}</p>
          <Button variant="outline" onClick={() => void load()}><RefreshCw /> Retry</Button>
        </CardContent>
      </Card>
    )
  }
  if (!data) return null

  const pending = data.suggestions.filter((suggestion) => suggestion.review_state === 'pending')
  return (
    <div className="space-y-8">
      <section aria-labelledby="suggestions-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 id="suggestions-heading" className="text-xl font-semibold">Suggestion queue</h2>
            <p className="text-sm text-muted-foreground">Approve, rename, merge, or reject with source evidence visible.</p>
          </div>
          <Badge variant="secondary">{pending.length} pending</Badge>
        </div>
        {pending.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No pending topic suggestions.</CardContent></Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} topics={data.topics} onChanged={load} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="assignments-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 id="assignments-heading" className="text-xl font-semibold">Assignment review</h2>
            <p className="text-sm text-muted-foreground">Low-confidence tags remain private until approved.</p>
          </div>
          <Badge variant="secondary">{data.assignments.length} pending</Badge>
        </div>
        {data.assignments.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No pending assignments.</CardContent></Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.assignments.map((assignment) => (
              <AssignmentCard
                key={`${assignment.agenda_item_id}:${assignment.topic_id}`}
                assignment={assignment}
                onChanged={load}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="approved-heading">
        <div className="mb-4">
          <h2 id="approved-heading" className="text-xl font-semibold">Approved taxonomy</h2>
          <p className="text-sm text-muted-foreground">Deactivated topics disappear from public filters and rollups.</p>
        </div>
        <div className="space-y-3">
          {data.topics.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No approved topics yet.</CardContent></Card>
          ) : data.topics.map((topic) => <TopicEditor key={topic.id} topic={topic} onChanged={load} />)}
        </div>
      </section>
      {error && <p className="text-sm text-destructive" role="status">{error}</p>}
    </div>
  )
}

function AssignmentCard({
  assignment,
  onChanged,
}: {
  assignment: AssignmentReview
  onChanged: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const topic = Array.isArray(assignment.topic) ? assignment.topic[0] : assignment.topic
  const item = Array.isArray(assignment.agenda_item) ? assignment.agenda_item[0] : assignment.agenda_item
  const evidence = Array.isArray(assignment.evidence) ? assignment.evidence : []

  const review = async (action: 'approve' | 'reject') => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/topics/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agendaItemId: assignment.agenda_item_id,
          topicId: assignment.topic_id,
          action,
        }),
      })
      if (!response.ok) throw new Error('Assignment review failed')
      await onChanged()
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Assignment review failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{topic?.display_name ?? 'Unknown topic'}</CardTitle>
          <Badge variant="outline">{Math.round(assignment.confidence * 100)}%</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium">{item ? `${item.item_order} ${item.title}` : 'Agenda item unavailable'}</p>
        <p className="text-sm text-muted-foreground">{assignment.rationale}</p>
        {evidence.length > 0 && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            {evidence.slice(0, 3).map((example, index) => (
              <p key={index} className="border-l-2 border-primary/40 pl-3 [&:not(:last-child)]:mb-2">
                {formatExample(example)}
              </p>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => void review('approve')}><Check /> Approve</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void review('reject')}><X /> Reject</Button>
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </CardContent>
    </Card>
  )
}

function SuggestionCard({
  suggestion,
  topics,
  onChanged,
}: {
  suggestion: TopicSuggestion
  topics: Topic[]
  onChanged: () => Promise<void>
}) {
  const [name, setName] = useState(suggestion.proposed_name)
  const [slug, setSlug] = useState(suggestion.proposed_slug)
  const [mergeTopicId, setMergeTopicId] = useState(topics[0]?.id ?? '')
  const [parentId, setParentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const examples = Array.isArray(suggestion.examples) ? suggestion.examples : []

  const update = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/topics/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: suggestion.id, ...body }),
      })
      if (!response.ok) throw new Error('Review action failed')
      await onChanged()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Review action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{suggestion.proposed_name}</CardTitle>
          <Badge variant="outline">{suggestion.occurrence_count} occurrences</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{suggestion.rationale || 'No rationale supplied.'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium">Public name<Input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="space-y-1 text-xs font-medium">Stable slug<Input value={slug} onChange={(event) => setSlug(event.target.value)} /></label>
        </div>
        {topics.length > 0 && (
          <label className="block space-y-1 text-xs font-medium">
            Parent topic (optional)
            <select value={parentId} onChange={(event) => setParentId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Top level</option>
              {topics.filter((topic) => topic.parent_id === null).map((topic) => (
                <option key={topic.id} value={topic.id}>{topic.display_name}</option>
              ))}
            </select>
          </label>
        )}
        {examples.length > 0 && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence examples</p>
            <ul className="space-y-2 text-sm">
              {examples.slice(0, 3).map((example, index) => (
                <li key={index} className="border-l-2 border-primary/40 pl-3">{formatExample(example)}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy || !name || !slug} onClick={() => void update({ action: 'approve', displayName: name, slug, description: suggestion.rationale, parentId: parentId || null })}>
            <Check /> Approve
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void update({ action: 'reject' })}><X /> Reject</Button>
        </div>
        {topics.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row">
            <label className="sr-only" htmlFor={`merge-${suggestion.id}`}>Merge target</label>
            <select id={`merge-${suggestion.id}`} value={mergeTopicId} onChange={(event) => setMergeTopicId(event.target.value)} className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm">
              {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.display_name}</option>)}
            </select>
            <Button size="sm" variant="secondary" disabled={busy || !mergeTopicId} onClick={() => void update({ action: 'merge', topicId: mergeTopicId })}>Merge</Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </CardContent>
    </Card>
  )
}

function TopicEditor({ topic, onChanged }: { topic: Topic; onChanged: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState(topic.display_name)
  const [busy, setBusy] = useState(false)
  const save = async (body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('Topic update failed')
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={!topic.active ? 'opacity-65' : undefined}>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Input aria-label={`Display name for ${topic.display_name}`} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">{topic.slug} · taxonomy v{topic.taxonomy_version}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy || displayName === topic.display_name} onClick={() => void save({ displayName })}><Save /> Save</Button>
          <Button size="sm" variant={topic.active ? 'destructive' : 'secondary'} disabled={busy} onClick={() => void save({ active: !topic.active })}>
            {topic.active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function formatExample(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'quote' in value && typeof value.quote === 'string') return value.quote
  return JSON.stringify(value)
}
