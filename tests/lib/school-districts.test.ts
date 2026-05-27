import { describe, expect, it } from 'vite-plus/test'
import {
  ACTIVE_SCHOOL_DISTRICTS,
  SCHOOL_DISTRICT_IDS,
  getBoardDocsBaseUrl,
  getSchoolDistrict,
  shouldImportRegularMeeting,
} from '@/lib/school-districts'

describe('school district config', () => {
  it('defines all active district IDs with BoardDocs URLs', () => {
    expect(SCHOOL_DISTRICT_IDS).toEqual([
      'fairfax',
      'loudoun',
      'prince-william',
      'arlington',
    ])
    expect(ACTIVE_SCHOOL_DISTRICTS).toHaveLength(4)

    for (const district of ACTIVE_SCHOOL_DISTRICTS) {
      expect(district.sourceUrl()).toBe(
        `${getBoardDocsBaseUrl(district.id)}/Public`
      )
      expect(district.sourceUrl('ABC123')).toBe(
        `${getBoardDocsBaseUrl(district.id)}/goto?open&id=ABC123`
      )
      expect(district.boardDocs.committeeId).toMatch(/^A9H/)
    }
  })

  it('keeps Loudoun County Public Schools as the Loudoun label', () => {
    expect(getSchoolDistrict('loudoun').schoolSystemLabel).toBe(
      'Loudoun County Public Schools'
    )
  })
})

describe('regular meeting filters', () => {
  it('filters Fairfax regular meetings', () => {
    expect(shouldImportRegularMeeting('fairfax', 'Regular Meeting #12')).toBe(true)
    expect(shouldImportRegularMeeting('fairfax', 'Regular Meeting - Canceled')).toBe(false)
    expect(shouldImportRegularMeeting('fairfax', 'Work Session')).toBe(false)
  })

  it('filters Loudoun regular meetings', () => {
    expect(
      shouldImportRegularMeeting('loudoun', '2nd Tuesday School Board Meeting')
    ).toBe(true)
    expect(
      shouldImportRegularMeeting('loudoun', '4th Tuesday School Board Meeting')
    ).toBe(true)
    expect(
      shouldImportRegularMeeting('loudoun', '2nd Tuesday School Board Meeting - Closed Session')
    ).toBe(false)
  })

  it('filters Prince William regular meetings', () => {
    expect(shouldImportRegularMeeting('prince-william', 'School Board Meeting')).toBe(true)
    expect(
      shouldImportRegularMeeting('prince-william', 'School Board Meeting Work Session')
    ).toBe(false)
    expect(
      shouldImportRegularMeeting('prince-william', 'School Board Meeting Joint Meeting')
    ).toBe(false)
  })

  it('filters Arlington regular meetings', () => {
    expect(shouldImportRegularMeeting('arlington', 'School Board Meeting')).toBe(true)
    expect(
      shouldImportRegularMeeting('arlington', 'School Board Meeting - Policy Subcommittee')
    ).toBe(false)
    expect(
      shouldImportRegularMeeting('arlington', 'School Board Meeting - Work Session')
    ).toBe(false)
  })
})
