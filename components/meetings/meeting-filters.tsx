'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { MEETING_BODIES } from '@/lib/constants'
import type { TopicWithCount } from '@/lib/data/topics'

interface MeetingFiltersProps {
  currentBody?: string
  topicGroups: TopicWithCount[]
  selectedTopics: string[]
}

export function MeetingFilters({
  currentBody,
  topicGroups,
  selectedTopics,
}: MeetingFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selected = new Set(selectedTopics)

  const navigate = (params: URLSearchParams) => {
    params.delete('page')
    router.push(`/meetings?${params.toString()}`)
  }

  const handleBodyChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') params.delete('body')
    else params.set('body', value)
    navigate(params)
  }

  const toggleTopic = (slug: string) => {
    const nextTopics = new Set(selected)
    if (nextTopics.has(slug)) nextTopics.delete(slug)
    else nextTopics.add(slug)

    const params = new URLSearchParams(searchParams.toString())
    params.delete('topic')
    for (const topic of nextTopics) params.append('topic', topic)
    navigate(params)
  }

  const clearTopics = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('topic')
    navigate(params)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="body-filter" className="text-sm font-medium text-muted-foreground">
            Filter by:
          </label>
          <Select value={currentBody || 'all'} onValueChange={handleBodyChange}>
            <SelectTrigger id="body-filter" className="w-[220px] max-w-full">
              <SelectValue placeholder="All meeting bodies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All meeting bodies</SelectItem>
              {MEETING_BODIES.map((body) => (
                <SelectItem key={body} value={body}>{body}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {topicGroups.length > 0 && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="md:hidden">
                <SlidersHorizontal />
                Topics
                {selected.size > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                    {selected.size}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl">
              <SheetHeader>
                <SheetTitle>Filter by topic</SheetTitle>
                <SheetDescription>Meetings matching any selected topic appear.</SheetDescription>
              </SheetHeader>
              <div className="overflow-y-auto px-4 pb-4">
                <TopicChoices idPrefix="mobile" groups={topicGroups} selected={selected} onToggle={toggleTopic} />
              </div>
              <SheetFooter className="border-t">
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={clearTopics} disabled={selected.size === 0}>
                    Clear all
                  </Button>
                  <SheetClose asChild>
                    <Button className="flex-1">Done</Button>
                  </SheetClose>
                </div>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        )}

        {selected.size > 0 && (
          <Button variant="ghost" size="sm" onClick={clearTopics} className="text-muted-foreground">
            <X /> Clear topics
          </Button>
        )}
      </div>

      {topicGroups.length > 0 && (
        <div className="hidden rounded-lg border border-border bg-card p-4 md:block">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Topics</h2>
              <p className="text-xs text-muted-foreground">Select one or more. Matches use OR.</p>
            </div>
            {selected.size > 0 && (
              <Button variant="ghost" size="sm" onClick={clearTopics}>Clear all</Button>
            )}
          </div>
          <TopicChoices idPrefix="desktop" groups={topicGroups} selected={selected} onToggle={toggleTopic} />
        </div>
      )}
    </div>
  )
}

function TopicChoices({
  groups,
  selected,
  onToggle,
  idPrefix,
}: {
  groups: TopicWithCount[]
  selected: Set<string>
  onToggle: (slug: string) => void
  idPrefix: string
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <fieldset key={group.id} className="space-y-2">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.children.length > 0 ? group.display_name : 'Topics'}
          </legend>
          {group.children.length === 0 && (
            <TopicCheckbox idPrefix={idPrefix} topic={group} checked={selected.has(group.slug)} onToggle={onToggle} />
          )}
          {group.children.map((topic) => (
            <TopicCheckbox
              key={topic.id}
              idPrefix={idPrefix}
              topic={topic}
              checked={selected.has(topic.slug)}
              onToggle={onToggle}
            />
          ))}
        </fieldset>
      ))}
    </div>
  )
}

function TopicCheckbox({
  topic,
  checked,
  onToggle,
  idPrefix,
}: {
  topic: TopicWithCount
  checked: boolean
  onToggle: (slug: string) => void
  idPrefix: string
}) {
  const id = `${idPrefix}-topic-${topic.slug}`
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
      <span className="flex min-w-0 items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(topic.slug)}
          className="size-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="truncate text-sm text-foreground">{topic.display_name}</span>
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">{topic.meetingCount}</span>
    </label>
  )
}
