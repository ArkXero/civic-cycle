import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NextRequest } from 'next/server'

const mockAdminFrom = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('@/lib/auth/is-admin-server', () => ({
  isAdminUser: vi.fn().mockResolvedValue(true),
}))

import { GET } from '@/app/api/admin/analytics/cost-timeline/route'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeUsageChain(result: { data: unknown; error: unknown }): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = Promise.resolve(result)
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockResolvedValue(result)
  return chain
}

function makeRequest(range = '7d') {
  return new NextRequest(`http://localhost/api/admin/analytics/cost-timeline?range=${range}`)
}

describe('GET /api/admin/analytics/cost-timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null,
    })
  })

  it('counts distinct successful meeting IDs as summaries while summing per-call cost', async () => {
    const today = new Date().toISOString()
    mockAdminFrom.mockReturnValue(makeUsageChain({
      data: [
        {
          created_at: today,
          meeting_id: 'meeting-1',
          cost_cents: 6,
        },
        {
          created_at: today,
          meeting_id: 'meeting-1',
          cost_cents: 12,
        },
        {
          created_at: today,
          meeting_id: 'meeting-2',
          cost_cents: 18,
        },
      ],
      error: null,
    }))

    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    const body = await res.json()
    const todayPoint = body.points.at(-1)
    expect(todayPoint.cost_cents).toBe(36)
    expect(todayPoint.summaries).toBe(2)
    expect(body.total_cost_cents).toBe(36)
  })
})
