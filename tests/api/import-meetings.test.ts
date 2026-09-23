import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  listMeetings: vi.fn(),
  refreshMeeting: vi.fn(),
  logActivity: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: vi.fn(), rpc: vi.fn() }),
}))

vi.mock('@/lib/boarddocs', () => ({
  listMeetings: (...args: unknown[]) => mocks.listMeetings(...args),
}))

vi.mock('@/lib/boarddocs-refresh', () => ({
  boardDocsResultsGraceDays: () => 21,
  isFutureBoardDocsMeeting: () => false,
  shouldPollBoardDocsResults: () => true,
  refreshBoardDocsMeeting: (...args: unknown[]) => mocks.refreshMeeting(...args),
}))

vi.mock('@/lib/activity', () => ({
  ActivityTypes: { MEETING_IMPORTED: 'meeting_imported' },
  logActivity: (...args: unknown[]) => mocks.logActivity(...args),
}))

import { runImport } from '@/app/api/cron/import-meetings/route'

describe('BoardDocs import cron', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-23T16:00:00.000Z'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('counts a thrown refresh as a failed import and continues', async () => {
    mocks.listMeetings.mockResolvedValue([{
      id: 'BOARD-DOCS-1',
      name: 'Regular Meeting',
      date: new Date('2026-09-20T12:00:00.000Z'),
      numberDate: '20260920',
      unid: 'UNID',
    }])
    mocks.refreshMeeting.mockRejectedValue(new Error('BoardDocs timed out'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runImport('fairfax')).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to import fairfax meeting "Regular Meeting":',
      'BoardDocs timed out'
    )
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 failed'))
    expect(mocks.logActivity).not.toHaveBeenCalled()
  })
})
