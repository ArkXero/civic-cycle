import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Topic } from '@/types'

type DBClient = SupabaseClient<Database>

export interface TopicWithCount extends Topic {
  meetingCount: number
  children: TopicWithCount[]
}

export function normalizeTopicSlugs(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()))]
    .filter((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
    .slice(0, 20)
}

export async function getApprovedTopicHierarchy(supabase: DBClient): Promise<TopicWithCount[]> {
  const [{ data: topics, error: topicError }, { data: meetingTopics, error: meetingTopicError }] =
    await Promise.all([
      supabase.from('topics').select('*').eq('active', true).order('display_name'),
      supabase.from('meeting_topics').select('meeting_id, topic_id'),
    ])

  if (topicError) throw topicError
  if (meetingTopicError) throw meetingTopicError

  const meetingIdsByTopic = new Map<string, Set<string>>()
  for (const assignment of meetingTopics ?? []) {
    const meetingIds = meetingIdsByTopic.get(assignment.topic_id) ?? new Set<string>()
    meetingIds.add(assignment.meeting_id)
    meetingIdsByTopic.set(assignment.topic_id, meetingIds)
  }

  const nodes = new Map<string, TopicWithCount>()
  for (const topic of topics ?? []) {
    nodes.set(topic.id, {
      ...topic,
      meetingCount: meetingIdsByTopic.get(topic.id)?.size ?? 0,
      children: [],
    })
  }

  const roots: TopicWithCount[] = []
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return roots
}

export async function getMeetingIdsForTopicSlugs(supabase: DBClient, rawSlugs: string[]) {
  const slugs = normalizeTopicSlugs(rawSlugs)
  if (slugs.length === 0) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('meeting_topics')
    .select('meeting_id, topic:topics!inner(slug)')
    .in('topic.slug', slugs)

  if (error) throw error
  return [...new Set((data ?? []).map((row: { meeting_id: string }) => row.meeting_id))]
}

export async function getApprovedTopicsByMeetingIds(supabase: DBClient, meetingIds: string[]) {
  const result = new Map<string, Topic[]>()
  if (meetingIds.length === 0) return result

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('meeting_topics')
    .select('meeting_id, topic:topics!inner(*)')
    .in('meeting_id', meetingIds)
    .order('generated_at', { ascending: false })
  if (error) throw error

  for (const row of data ?? []) {
    const topic = Array.isArray(row.topic) ? row.topic[0] : row.topic
    if (!topic) continue
    const topics = result.get(row.meeting_id) ?? []
    topics.push(topic as Topic)
    result.set(row.meeting_id, topics)
  }

  for (const topics of result.values()) {
    topics.sort((a, b) => a.display_name.localeCompare(b.display_name))
  }
  return result
}
