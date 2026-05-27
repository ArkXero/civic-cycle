export const SCHOOL_DISTRICT_IDS = [
  'fairfax',
  'loudoun',
  'prince-william',
  'arlington',
] as const

export type SchoolDistrictId = (typeof SCHOOL_DISTRICT_IDS)[number]

export const DEFAULT_SCHOOL_DISTRICT_ID: SchoolDistrictId = 'fairfax'

interface BoardDocsConfig {
  state: string
  slug: string
  committeeId: string
}

export interface SchoolDistrictConfig {
  id: SchoolDistrictId
  uiLabel: string
  schoolSystemLabel: string
  boardBodyLabel: string
  digestSubjectLabel: string
  boardDocs: BoardDocsConfig
  sourceUrl: (itemId?: string) => string
  regularMeetingFilterDescription: string
}

const BOARDDOCS_HOST = 'https://go.boarddocs.com'

function boardDocsBaseUrl({ state, slug }: BoardDocsConfig) {
  return `${BOARDDOCS_HOST}/${state}/${slug}/Board.nsf`
}

function boardDocsSourceUrl(boardDocs: BoardDocsConfig, itemId?: string) {
  const baseUrl = boardDocsBaseUrl(boardDocs)
  return itemId ? `${baseUrl}/goto?open&id=${itemId}` : `${baseUrl}/Public`
}

export const SCHOOL_DISTRICTS: Record<SchoolDistrictId, SchoolDistrictConfig> = {
  fairfax: {
    id: 'fairfax',
    uiLabel: 'Fairfax',
    schoolSystemLabel: 'Fairfax County Public Schools',
    boardBodyLabel: 'FCPS School Board',
    digestSubjectLabel: 'FCPS School Board',
    boardDocs: {
      state: 'vsba',
      slug: 'fairfax',
      committeeId: 'A9HDX937D70D',
    },
    sourceUrl(itemId) {
      return boardDocsSourceUrl(SCHOOL_DISTRICTS.fairfax.boardDocs, itemId)
    },
    regularMeetingFilterDescription:
      'Imports meetings whose names start with "Regular Meeting" and excludes canceled meetings.',
  },
  loudoun: {
    id: 'loudoun',
    uiLabel: 'Loudoun',
    schoolSystemLabel: 'Loudoun County Public Schools',
    boardBodyLabel: 'Loudoun County School Board',
    digestSubjectLabel: 'Loudoun School Board',
    boardDocs: {
      state: 'vsba',
      slug: 'loudoun',
      committeeId: 'A9HF2C3CFB4E',
    },
    sourceUrl(itemId) {
      return boardDocsSourceUrl(SCHOOL_DISTRICTS.loudoun.boardDocs, itemId)
    },
    regularMeetingFilterDescription:
      'Imports 2nd and 4th Tuesday School Board Meetings and excludes canceled or closed-session-only meetings.',
  },
  'prince-william': {
    id: 'prince-william',
    uiLabel: 'Prince William',
    schoolSystemLabel: 'Prince William County Public Schools',
    boardBodyLabel: 'Prince William County School Board',
    digestSubjectLabel: 'Prince William School Board',
    boardDocs: {
      state: 'vsba',
      slug: 'pwcs',
      committeeId: 'A9HETF3BF91A',
    },
    sourceUrl(itemId) {
      return boardDocsSourceUrl(SCHOOL_DISTRICTS['prince-william'].boardDocs, itemId)
    },
    regularMeetingFilterDescription:
      'Imports School Board Meetings and excludes disciplinary committee, special, work-session, and joint meetings.',
  },
  arlington: {
    id: 'arlington',
    uiLabel: 'Arlington',
    schoolSystemLabel: 'Arlington Public Schools',
    boardBodyLabel: 'Arlington School Board',
    digestSubjectLabel: 'Arlington School Board',
    boardDocs: {
      state: 'vsba',
      slug: 'arlington',
      committeeId: 'A9HEVC3C409D',
    },
    sourceUrl(itemId) {
      return boardDocsSourceUrl(SCHOOL_DISTRICTS.arlington.boardDocs, itemId)
    },
    regularMeetingFilterDescription:
      'Imports names containing "School Board Meeting" and excludes canceled, committee, and work-session meetings.',
  },
}

export const ACTIVE_SCHOOL_DISTRICTS = SCHOOL_DISTRICT_IDS.map(
  (id) => SCHOOL_DISTRICTS[id]
)

export function isSchoolDistrictId(value: unknown): value is SchoolDistrictId {
  return (
    typeof value === 'string' &&
    (SCHOOL_DISTRICT_IDS as readonly string[]).includes(value)
  )
}

export function parseSchoolDistrictId(
  value: unknown,
  fallback: SchoolDistrictId = DEFAULT_SCHOOL_DISTRICT_ID
): SchoolDistrictId {
  return isSchoolDistrictId(value) ? value : fallback
}

export function getSchoolDistrict(id: SchoolDistrictId): SchoolDistrictConfig {
  return SCHOOL_DISTRICTS[id]
}

export function getBoardDocsBaseUrl(districtId: SchoolDistrictId) {
  return boardDocsBaseUrl(SCHOOL_DISTRICTS[districtId].boardDocs)
}

export function shouldImportRegularMeeting(
  districtId: SchoolDistrictId,
  meetingName: string
) {
  const name = meetingName.trim()
  const canceled = /\bcancell?ed\b/i.test(name)

  switch (districtId) {
    case 'fairfax':
      return /^Regular Meeting/i.test(name) && !canceled
    case 'loudoun':
      return (
        /^(2nd|4th) Tuesday School Board Meeting/i.test(name) &&
        !canceled &&
        !/\bclosed session\b/i.test(name)
      )
    case 'prince-william':
      return (
        /^School Board Meeting/i.test(name) &&
        !/\b(disciplinary committee|special meeting|work session|joint meeting)\b/i.test(name)
      )
    case 'arlington':
      return (
        /School Board Meeting/i.test(name) &&
        !canceled &&
        !/\b(policy subcommittee|audit committee|committee of the whole|work session)\b/i.test(name)
      )
  }
}

export function schoolDistrictCheckSqlList() {
  return SCHOOL_DISTRICT_IDS.map((id) => `'${id}'`).join(', ')
}
