import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'

const updateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().max(1_000).optional(),
  synonyms: z.array(z.string().min(1).max(100)).max(50).optional(),
  parentId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0)

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !await isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid topic ID' }, { status: 400 })
  }
  const values = parsed.data
  if (values.parentId === id) {
    return NextResponse.json({ error: 'Topic cannot be its own parent' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (values.parentId) {
    const { data: parent, error: parentError } = await admin
      .from('topics')
      .select('id, parent_id')
      .eq('id', values.parentId)
      .maybeSingle()
    if (parentError) return NextResponse.json({ error: 'Could not validate parent topic' }, { status: 500 })
    if (!parent || parent.parent_id) {
      return NextResponse.json({ error: 'Parent must be a top-level topic' }, { status: 400 })
    }

    const { data: child, error: childError } = await admin
      .from('topics')
      .select('id')
      .eq('parent_id', id)
      .limit(1)
      .maybeSingle()
    if (childError) return NextResponse.json({ error: 'Could not validate topic hierarchy' }, { status: 500 })
    if (child) {
      return NextResponse.json({ error: 'Topic with children must remain top-level' }, { status: 400 })
    }
  }

  const { data: updatedTopic, error } = await admin.from('topics').update({
    ...(values.displayName !== undefined && { display_name: values.displayName }),
    ...(values.description !== undefined && { description: values.description }),
    ...(values.synonyms !== undefined && { synonyms: values.synonyms }),
    ...(values.parentId !== undefined && { parent_id: values.parentId }),
    ...(values.active !== undefined && { active: values.active }),
    updated_at: new Date().toISOString(),
  }).eq('id', id).select('id').maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updatedTopic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  if (values.active !== undefined) {
    const { error: rollupError } = await admin.rpc('refresh_topic_meeting_rollups', {
      target_topic_id: id,
    })
    if (rollupError) {
      console.error('Failed to refresh topic meeting rollups:', rollupError)
      return NextResponse.json({ error: 'Topic updated but meeting rollup refresh failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
