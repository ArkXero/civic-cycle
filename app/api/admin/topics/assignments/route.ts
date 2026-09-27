import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'

const reviewSchema = z.object({
  agendaItemId: z.string().uuid(),
  topicId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !await isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = reviewSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const admin = createAdminClient()
  const { data: agendaItem, error: agendaItemError } = await admin
    .from('agenda_items')
    .select('meeting_id')
    .eq('id', parsed.data.agendaItemId)
    .single()
  if (agendaItemError) return NextResponse.json({ error: agendaItemError.message }, { status: 404 })

  const { error } = await admin.from('agenda_item_topics').update({
    review_status: parsed.data.action === 'approve' ? 'approved' : 'rejected',
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('agenda_item_id', parsed.data.agendaItemId).eq('topic_id', parsed.data.topicId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: rollupError } = await admin.rpc('refresh_meeting_topics', {
    target_meeting_id: agendaItem.meeting_id,
  })
  return rollupError
    ? NextResponse.json({ error: rollupError.message }, { status: 500 })
    : NextResponse.json({ ok: true })
}
