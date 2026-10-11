import type { MotionOutcome } from '@/types'

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'vs'])
const ACRONYMS = new Set(['FCPS', 'ST', 'EIRI', 'CIP', 'FY', 'SOL', 'SOLS', 'HVAC', 'MS', 'HS', 'ES', 'PTA', 'VDOE', 'II', 'III', 'IV', 'ADA', 'IEP', 'ESOL', 'TJHSST', 'AAP', 'K'])

function titleCaseWord(word: string, index: number) {
  const bare = word.replace(/[^A-Za-z+]/g, '').toUpperCase()
  if (ACRONYMS.has(bare) || /[\d+/]/.test(word)) return word
  const lower = word.toLowerCase()
  if (index > 0 && SMALL_WORDS.has(lower)) return lower
  return lower.replace(/^([("'“]*)([a-z])/, (_, lead: string, char: string) => lead + char.toUpperCase())
}

/**
 * BoardDocs titles arrive as "4.01 SUPERINTENDENT'S RECOMMENDATION…".
 * Drop the repeated item number and soften all-caps into title case.
 */
export function cleanAgendaTitle(title: string, itemOrder?: string) {
  let cleaned = title.trim()
  if (itemOrder && cleaned.startsWith(itemOrder)) {
    cleaned = cleaned.slice(itemOrder.length).replace(/^[\s.:·-]+/, '')
  }
  const letters = cleaned.replace(/[^A-Za-z]/g, '')
  const isAllCaps = letters.length > 3 && letters === letters.toUpperCase()
  if (!isAllCaps) return cleaned
  return cleaned.split(/\s+/).map(titleCaseWord).join(' ')
}

export function formatTally(yes: number | null, no: number | null, abstain: number | null) {
  if (yes === null && no === null && abstain === null) return null
  const parts = [yes ?? 0, no ?? 0]
  if (abstain) parts.push(abstain)
  return parts.join('–')
}

export const OUTCOME_LABEL: Record<MotionOutcome, string> = {
  passed: 'Passed',
  failed: 'Failed',
  postponed: 'Postponed',
  tabled: 'Tabled',
  withdrawn: 'Withdrawn',
  unknown: 'No result',
}

/** Docket-style date: "OCT 08 2026" */
export function docketDate(date: string) {
  const d = new Date(date)
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  const day = d.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'UTC' })
  return { month, day, year: String(d.getUTCFullYear()), weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase() }
}

const BOILERPLATE_OPENING =
  /^The [\w\s.]*?Board held (?:a|an|its)\b[^.]{0,90}?,?\s+(?:where|during which)\s+/i

/**
 * Most summaries open with "The Fairfax County School Board held a regular meeting on
 * October 8, 2026, where…". Drop that preamble so list rows lead with what happened.
 */
export function summaryExcerpt(text: string) {
  const firstParagraph = text.split('\n\n')[0]?.trim() ?? ''
  const stripped = firstParagraph.replace(BOILERPLATE_OPENING, '')
  if (stripped === firstParagraph) return firstParagraph
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}
