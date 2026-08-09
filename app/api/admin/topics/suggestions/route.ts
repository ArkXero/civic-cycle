import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'

const updateSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    id: z.string().uuid(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    displayName: z.string().min(1).max(100),
    description: z.string().max(1_000).default(''),
    parentId: z.string().uuid().nullable().default(null),
  }),
  z.object({ action: z.literal('reject'), id: z.string().uuid() }),
  z.object({
    action: z.literal('merge'),
    id: z.string().uuid(),
    topicId: z.string().uuid(),
  }),
])

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user && await isAdminUser(user)
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignmentQuery = (admin as any).from('agenda_item_topics')
    .select('*, topic:topics(*), agenda_item:agenda_items(id,title,item_order,meeting_id)')
    .eq('review_status', 'pending')
    .order('confidence', { ascending: false })
  const [
    { data: suggestions, error },
    { data: topics, error: topicError },
    { data: assignments, error: assignmentError },
  ] = await Promise.all([
    admin.from('topic_suggestions').select('*').order('occurrence_count', { ascending: false }),
    admin.from('topics').select('*').order('display_name'),
    assignmentQuery,
  ])
  if (error || topicError || assignmentError) {
    console.error('Failed to load taxonomy review:', error ?? topicError ?? assignmentError)
    return NextResponse.json({ error: 'Failed to load taxonomy review' }, { status: 500 })
  }
  return NextResponse.json({ data: { suggestions, topics, assignments } })
}

export async function PATCH(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const admin = createAdminClient()
  const reviewedAt = new Date().toISOString()
  if (parsed.data.action === 'reject') {
    const { error } = await admin.from('topic_suggestions').update({
      review_state: 'rejected',
      reviewed_at: reviewedAt,
    }).eq('id', parsed.data.id)
    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ ok: true })
  }

  if (parsed.data.action === 'merge') {
    const { error } = await admin.from('topic_suggestions').update({
      review_state: 'merged',
      merged_topic_id: parsed.data.topicId,
      reviewed_at: reviewedAt,
    }).eq('id', parsed.data.id)
    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ ok: true })
  }

  const { data: existingTopic, error: existingError } = await admin
    .from('topics')
    .select('id')
    .eq('slug', parsed.data.slug)
    .maybeSingle()
  if (existingError) {
    return NextResponse.json({ error: 'Could not validate topic slug' }, { status: 500 })
  }
  if (existingTopic) {
    return NextResponse.json(
      { error: 'Topic slug already exists; merge the suggestion instead' },
      { status: 409 }
    )
  }

  if (parsed.data.parentId) {
    const { data: parent, error: parentError } = await admin
      .from('topics')
      .select('id, parent_id')
      .eq('id', parsed.data.parentId)
      .maybeSingle()
    if (parentError) {
      return NextResponse.json({ error: 'Could not validate topic hierarchy' }, { status: 500 })
    }
    if (!parent || parent.parent_id) {
      return NextResponse.json({ error: 'Parent must be a different top-level topic' }, { status: 400 })
    }
  }

  const { data: topic, error: topicError } = await admin.from('topics').insert({
    slug: parsed.data.slug,
    display_name: parsed.data.displayName,
    description: parsed.data.description,
    parent_id: parsed.data.parentId,
    active: true,
  }).select('id').single()
  if (topicError) {
    return topicError.code === '23505'
      ? NextResponse.json(
          { error: 'Topic slug already exists; merge the suggestion instead' },
          { status: 409 }
        )
      : NextResponse.json({ error: topicError.message }, { status: 500 })
  }

  const { error } = await admin.from('topic_suggestions').update({
    review_state: 'approved',
    merged_topic_id: topic.id,
    reviewed_at: reviewedAt,
  }).eq('id', parsed.data.id)
  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ ok: true, topicId: topic.id })
}
