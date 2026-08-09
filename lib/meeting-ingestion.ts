import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { IngestedAgendaItem, MeetingContentResult } from '@/lib/boarddocs'

type DatabaseClient = SupabaseClient<Database>

export function attachmentIngestionEnabled() {
  return process.env.BOARDDOCS_ATTACHMENT_INGESTION === 'enabled'
}

async function persistDocument(
  supabase: DatabaseClient,
  meetingId: string,
  agendaItemId: string,
  document: IngestedAgendaItem['documents'][number]
) {
  const row = {
    meeting_id: meetingId,
    agenda_item_id: agendaItemId,
    external_file_id: document.id,
    title: document.name,
    source_url: document.url,
    checksum_sha256: document.checksumSha256,
    parser_name: document.parserName,
    parser_version: document.parserVersion,
    extracted_markdown: document.markdown,
    page_count: document.pageCount,
    byte_size: document.byteSize,
    extraction_status: document.status,
    error_details: document.error,
    updated_at: new Date().toISOString(),
  }

  if (document.checksumSha256) {
    const { error } = await supabase
      .from('meeting_documents')
      .upsert(row, { onConflict: 'meeting_id,external_file_id,checksum_sha256' })
    if (error) throw error
    return
  }

  const { data: existing, error: lookupError } = await supabase
    .from('meeting_documents')
    .select('id')
    .eq('meeting_id', meetingId)
    .eq('external_file_id', document.id)
    .is('checksum_sha256', null)
    .maybeSingle()
  if (lookupError) throw lookupError

  const result = existing
    ? await supabase.from('meeting_documents').update(row).eq('id', existing.id)
    : await supabase.from('meeting_documents').insert(row)
  if (result.error) throw result.error
}

export async function persistMeetingIngestion(
  supabase: DatabaseClient,
  meetingId: string,
  content: Pick<MeetingContentResult, 'agendaItems'>
) {
  for (const item of content.agendaItems) {
    const { data: agendaItem, error: agendaItemError } = await supabase
      .from('agenda_items')
      .upsert({
        meeting_id: meetingId,
        external_id: item.agenda.id,
        item_order: item.agenda.order,
        category: item.content.category || item.agenda.category,
        item_type: item.content.type || item.agenda.type,
        title: item.content.name || item.agenda.name,
        recommended_action: item.content.recommendedAction,
        body_markdown: item.content.bodyMarkdown,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'meeting_id,external_id' })
      .select('id')
      .single()

    if (agendaItemError) throw agendaItemError
    for (const document of item.documents) {
      await persistDocument(supabase, meetingId, agendaItem.id, document)
    }
  }
}
