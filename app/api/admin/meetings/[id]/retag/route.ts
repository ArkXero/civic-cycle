import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { getSummaryModel } from '@/lib/anthropic-models'
import {
  assignmentReviewStatus,
  classifyMarkdownAgainstTopics,
  rollupTopicAssignments,
  type TopicAssignmentCandidate,
  type TopicSuggestionCandidate,
} from '@/lib/topic-classification'
import type { Json } from '@/types/database'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  void request
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !await isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const rateLimit = checkRateLimit(`meeting-retag:${user.id}`, 5, 60 * 60 * 1_000)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Retag limit reached' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1_000)) },
      }
    )
  }

  try {
    const { id: meetingId } = await params
    const admin = createAdminClient()
    const [
      { data: items, error: itemError },
      { data: documents, error: documentError },
      { data: topics, error: topicError },
    ] = await Promise.all([
      admin.from('agenda_items').select('*').eq('meeting_id', meetingId).order('item_order'),
      admin.from('meeting_documents').select('*').eq('meeting_id', meetingId).eq('extraction_status', 'extracted'),
      admin.from('topics').select('*').eq('active', true),
    ])

    if (itemError || documentError || topicError) {
      console.error('Failed to prepare meeting retag:', itemError ?? documentError ?? topicError)
      return NextResponse.json({ error: 'Failed to prepare meeting retag' }, { status: 500 })
    }
    if (!items?.length) {
      return NextResponse.json({ error: 'Meeting has no persisted agenda items' }, { status: 409 })
    }

    const model = getSummaryModel()
    const classifierVersion = `node-anthropic:${model}:v1`
    const calibratedPrecision = Number(process.env.TOPIC_CLASSIFIER_CALIBRATED_PRECISION ?? 0)
    const publishThreshold = Number(process.env.TOPIC_AUTO_PUBLISH_THRESHOLD ?? 1)
    let assignmentCount = 0
    let preservedReviewedCount = 0

    for (const item of items) {
      const itemLabel = `${item.item_order} ${item.title}`
      const agendaSource = [
        `# ${itemLabel}`,
        item.category && `Category: ${item.category}`,
        item.item_type && `Type: ${item.item_type}`,
        item.recommended_action && `Recommended Action: ${item.recommended_action}`,
        item.body_markdown,
      ].filter(Boolean).join('\n\n')
      const sources = [
        { markdown: agendaSource, sourceLabel: itemLabel },
        ...(documents ?? [])
          .filter((document) => document.agenda_item_id === item.id && document.extracted_markdown)
          .map((document) => ({
            markdown: document.extracted_markdown as string,
            sourceLabel: `${itemLabel} / ${document.title}`,
          })),
      ].filter((source) => source.markdown.trim())

      const itemAssignments: TopicAssignmentCandidate[] = []
      const itemSuggestions: TopicSuggestionCandidate[] = []
      for (const source of sources) {
        const classification = await classifyMarkdownAgainstTopics({
          ...source,
          topics,
          model,
        })
        itemAssignments.push(...classification.assignments)
        itemSuggestions.push(...classification.suggestions)
      }

      const { data: reviewedAssignments, error: reviewedError } = await admin
        .from('agenda_item_topics')
        .select('topic_id')
        .eq('agenda_item_id', item.id)
        .not('reviewed_at', 'is', null)
      if (reviewedError) throw reviewedError
      const reviewedTopicIds = new Set(
        (reviewedAssignments ?? []).map((assignment) => assignment.topic_id)
      )

      const { error: clearError } = await admin.from('agenda_item_topics')
        .delete()
        .eq('agenda_item_id', item.id)
        .is('reviewed_at', null)
      if (clearError) throw clearError

      for (const assignment of rollupTopicAssignments(itemAssignments)) {
        if (reviewedTopicIds.has(assignment.topic_id)) {
          preservedReviewedCount++
          continue
        }
        const { error } = await admin.from('agenda_item_topics').upsert({
          agenda_item_id: item.id,
          topic_id: assignment.topic_id,
          confidence: assignment.confidence,
          rationale: assignment.rationale,
          evidence: assignment.evidence as Json,
          classifier_version: classifierVersion,
          review_status: assignmentReviewStatus(
            assignment.confidence,
            calibratedPrecision,
            publishThreshold
          ),
          reviewed_at: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'agenda_item_id,topic_id',
          ignoreDuplicates: true,
        })
        if (error) throw error
        assignmentCount++
      }

      for (const suggestion of itemSuggestions) {
        const { data: existingSuggestion, error: suggestionLookupError } = await admin
          .from('topic_suggestions')
          .select('id, occurrence_count, examples')
          .eq('proposed_slug', suggestion.slug)
          .eq('classifier_version', classifierVersion)
          .maybeSingle()
        if (suggestionLookupError) throw suggestionLookupError

        const existingExamples = existingSuggestion && Array.isArray(existingSuggestion.examples)
          ? existingSuggestion.examples
          : []
        const serializedExamples = new Set(existingExamples.map((example) => JSON.stringify(example)))
        const newExamples = suggestion.evidence.filter(
          (example) => !serializedExamples.has(JSON.stringify(example))
        )
        const examples = [...existingExamples, ...newExamples].slice(-20)
        const suggestionResult = existingSuggestion
          ? await admin.from('topic_suggestions').update({
              proposed_name: suggestion.name,
              rationale: suggestion.rationale,
              examples: examples as Json,
              occurrence_count: existingSuggestion.occurrence_count + (newExamples.length > 0 ? 1 : 0),
            }).eq('id', existingSuggestion.id)
          : await admin.from('topic_suggestions').insert({
              proposed_slug: suggestion.slug,
              proposed_name: suggestion.name,
              rationale: suggestion.rationale,
              examples: examples as Json,
              classifier_version: classifierVersion,
            })
        if (suggestionResult.error) throw suggestionResult.error
      }
    }

    const { error: rollupError } = await admin.rpc('refresh_meeting_topics', {
      target_meeting_id: meetingId,
    })
    if (rollupError) throw rollupError

    return NextResponse.json({
      ok: true,
      assignmentCount,
      preservedReviewedCount,
      autoPublishEnabled: calibratedPrecision >= 0.9,
      classifierVersion,
    })
  } catch (error) {
    console.error('Meeting retag failed:', error)
    return NextResponse.json(
      { error: 'Meeting retag failed' },
      { status: 500 }
    )
  }
}
