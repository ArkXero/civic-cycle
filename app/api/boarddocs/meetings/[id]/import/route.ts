import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getMeetingContent, getBoardDocsUrl } from '@/lib/boarddocs'
import { isAdminEmail } from '@/lib/is-admin'

// POST /api/boarddocs/meetings/[id]/import - Import a BoardDocs meeting
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in' },
        { status: 401 }
      )
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sourceUrl = getBoardDocsUrl(id)

    // Check if already imported (using source_url which already exists in schema)
    // No `as any` needed — createAdminClient uses plain @supabase/supabase-js with proper types
    const adminClient = createAdminClient()

    const { data: existing } = await adminClient
      .from('meetings')
      .select('id')
      .eq('source_url', sourceUrl)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Already imported', message: 'This meeting has already been imported' },
        { status: 409 }
      )
    }

    // Fetch full meeting content from BoardDocs
    const content = await getMeetingContent(id)

    // Insert meeting — only using columns that exist in the current schema
    const meetingDate = content.date.toISOString().split('T')[0]

    const { data: meeting, error: insertError } = await adminClient
      .from('meetings')
      .insert({
        title: content.title,
        body: 'FCPS School Board',
        meeting_date: meetingDate,
        transcript_text: content.fullText,
        source: 'boarddocs',
        source_url: sourceUrl,
        status: 'pending',
      } as any)
      .select()
      .single()

    if (insertError) {
      console.error('Failed to insert meeting:', insertError)
      return NextResponse.json(
        { error: 'Insert error', message: insertError.message || 'Failed to save meeting to database' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Meeting imported successfully',
      data: meeting,
      itemCount: content.itemCount,
    }, { status: 201 })
  } catch (error) {
    console.error('Error importing meeting:', error)
    return NextResponse.json(
      { error: 'Import failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
