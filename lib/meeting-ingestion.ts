import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { IngestedAgendaItem, MeetingContentResult } from '@/lib/boarddocs'

type DatabaseClient = SupabaseClient<Database>

type VersionedMeetingDocument = Pick<
  Database['public']['Tables']['meeting_documents']['Row'],
  'id' | 'external_file_id' | 'created_at'
>

export function attachmentIngestionEnabled() {
  return process.env.BOARDDOCS_ATTACHMENT_INGESTION === 'enabled'
}

export function selectCurrentMeetingDocuments<T extends VersionedMeetingDocument>(
  documents: T[]
): T[] {
  const currentByExternalId = new Map<string, T>()

  for (const document of documents) {
    const current = currentByExternalId.get(document.external_file_id)
    if (
      !current ||
      document.created_at > current.created_at ||
      (document.created_at === current.created_at && document.id > current.id)
    ) {
      currentByExternalId.set(document.external_file_id, document)
    }
  }

  return [...currentByExternalId.values()]
}

export function motionRowsForPersistence(item: IngestedAgendaItem) {
  return item.content.motions.map((motion) => ({
    source_ordinal: motion.sourceOrdinal,
    content_hash: motion.contentHash,
    raw_html: motion.rawHtml,
    raw_motion_text: motion.rawText,
    normalized_motion_text: motion.normalizedText,
    motion_type: motion.motionType,
    parent_ordinal: motion.parentOrdinal,
    is_final: motion.isFinal,
    is_superseded: motion.isSuperseded,
    outcome: motion.outcome,
    vote_yes: motion.voteYes,
    vote_no: motion.voteNo,
    vote_abstain: motion.voteAbstain,
    mover: motion.mover,
    seconder: motion.seconder,
    roll_call_yes: motion.rollCallYes,
    roll_call_no: motion.rollCallNo,
    roll_call_abstain: motion.rollCallAbstain,
    parser_version: motion.parserVersion,
  }))
}

function agendaRowsForPersistence(items: IngestedAgendaItem[]) {
  return items.map((item) => ({
    external_id: item.agenda.id,
    item_order: item.agenda.order,
    category: item.content.category || item.agenda.category,
    item_type: item.content.type || item.agenda.type,
    title: item.content.name || item.agenda.name,
    recommended_action: item.content.recommendedAction,
    body_markdown: item.content.bodyMarkdown,
    motions: motionRowsForPersistence(item),
    documents: item.documents.map((document) => ({
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
    })),
  }))
}

export async function persistMeetingIngestion(
  supabase: DatabaseClient,
  meetingId: string,
  refreshToken: string,
  content: Pick<MeetingContentResult, 'title' | 'contentHash' | 'agendaItems'>,
  options: {
    meetingDate: string
    transcript: string | null
    checkedAt: string
    resultsSeenAt: string | null
  }
) {
  const { error } = await supabase.rpc('replace_boarddocs_meeting_content', {
    target_meeting_id: meetingId,
    target_refresh_token: refreshToken,
    new_title: content.title,
    new_meeting_date: options.meetingDate,
    new_content_hash: content.contentHash,
    new_transcript_text: options.transcript,
    new_last_checked_at: options.checkedAt,
    new_results_seen_at: options.resultsSeenAt,
    new_agenda_items: agendaRowsForPersistence(content.agendaItems) as Json,
  })
  if (error) throw error
}
