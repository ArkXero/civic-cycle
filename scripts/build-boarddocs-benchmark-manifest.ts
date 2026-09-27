import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getAgendaItemPublicFiles, getMeetingAgenda, listMeetings } from '@/lib/boarddocs'
import { SCHOOL_DISTRICT_IDS } from '@/lib/school-districts'

const TARGET_DOCUMENTS_PER_DISTRICT = 20
const TARGET_MEETINGS_PER_DISTRICT = 5
const MAX_MEETINGS_SCANNED_PER_DISTRICT = 40

interface ManifestDocument {
  id: string
  districtId: string
  meetingId: string
  meetingName: string
  meetingDate: string
  agendaItemId: string
  agendaItemOrder: string
  agendaItemName: string
  fileId: string
  fileName: string
  sourceUrl: string
  traits: Array<'native-text' | 'table' | 'presentation' | 'multi-column' | 'scanned'>
  visibleFacts: string[]
  humanScores: {
    readingOrder: number | null
    tablePreservation: number | null
    overallFidelity: number | null
  }
}

function selectAcrossMeetings(candidates: ManifestDocument[], target: number) {
  const groups = new Map<string, ManifestDocument[]>()
  for (const candidate of candidates) {
    const group = groups.get(candidate.meetingId) ?? []
    group.push(candidate)
    groups.set(candidate.meetingId, group)
  }

  const selected: ManifestDocument[] = []
  let round = 0
  while (selected.length < target) {
    let added = false
    for (const group of groups.values()) {
      if (group[round]) {
        selected.push(group[round])
        added = true
        if (selected.length === target) break
      }
    }
    if (!added) break
    round++
  }
  return selected
}

async function main() {
  const documents: ManifestDocument[] = []

  for (const districtId of SCHOOL_DISTRICT_IDS) {
    const meetings = await listMeetings(districtId)
    const districtDocuments: ManifestDocument[] = []
    const representedMeetings = new Set<string>()

    for (const meeting of meetings.slice(0, MAX_MEETINGS_SCANNED_PER_DISTRICT)) {
      if (
        districtDocuments.length >= TARGET_DOCUMENTS_PER_DISTRICT &&
        representedMeetings.size >= TARGET_MEETINGS_PER_DISTRICT
      )
        break

      const agenda = await getMeetingAgenda(meeting.id, districtId)
      for (const item of agenda.filter((candidate) => candidate.hasAttachment)) {
        const files = await getAgendaItemPublicFiles(item.id, districtId)
        for (const file of files) {
          districtDocuments.push({
            id: `${districtId}:${meeting.id}:${item.id}:${file.id}`,
            districtId,
            meetingId: meeting.id,
            meetingName: meeting.name,
            meetingDate: meeting.date.toISOString().slice(0, 10),
            agendaItemId: item.id,
            agendaItemOrder: item.order,
            agendaItemName: item.name,
            fileId: file.id,
            fileName: file.name,
            sourceUrl: file.url,
            traits: [],
            visibleFacts: [],
            humanScores: {
              readingOrder: null,
              tablePreservation: null,
              overallFidelity: null,
            },
          })
          representedMeetings.add(meeting.id)
        }
      }
    }

    if (districtDocuments.length < TARGET_DOCUMENTS_PER_DISTRICT) {
      throw new Error(`${districtId} produced only ${districtDocuments.length} attachments`)
    }
    if (representedMeetings.size < TARGET_MEETINGS_PER_DISTRICT) {
      throw new Error(
        `${districtId} produced attachments from only ${representedMeetings.size} meetings`,
      )
    }

    documents.push(...selectAcrossMeetings(districtDocuments, TARGET_DOCUMENTS_PER_DISTRICT))
  }

  const meetingCount = new Set(
    documents.map((document) => `${document.districtId}:${document.meetingId}`),
  ).size
  if (documents.length < 80 || meetingCount < 20) {
    throw new Error(
      `Manifest gate failed: ${documents.length} documents across ${meetingCount} meetings`,
    )
  }

  const outputPath = path.resolve('benchmark/boarddocs-attachments.json')
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        version: 1,
        frozenAt: new Date().toISOString(),
        source: 'BoardDocs public attachments',
        documentCount: documents.length,
        meetingCount,
        documents,
      },
      null,
      2,
    )}\n`,
  )
  console.log(
    `Frozen ${documents.length} attachments across ${meetingCount} meetings at ${outputPath}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
