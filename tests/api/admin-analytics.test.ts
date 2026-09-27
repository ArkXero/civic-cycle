import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const mockIsAdminUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
  createAdminClient: () => ({ rpc: mockRpc }),
}))

vi.mock('@/lib/auth/is-admin-server', () => ({
  isAdminUser: (...args: unknown[]) => mockIsAdminUser(...args),
}))

import { GET } from '@/app/api/admin/analytics/route'

function request(range = '30d') {
  return new NextRequest(`http://localhost/api/admin/analytics?range=${range}`)
}

describe('GET /api/admin/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null,
    })
    mockIsAdminUser.mockResolvedValue(true)
  })

  it('returns the database aggregate without caching it', async () => {
    const aggregate = {
      as_of: '2026-09-23T12:00:00.000Z',
      range: '90d',
      timezone: 'America/New_York',
      kpis: {},
      series: {},
    }
    mockRpc.mockResolvedValue({ data: aggregate, error: null })

    const response = await GET(request('90d'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    await expect(response.json()).resolves.toEqual(aggregate)
    expect(mockRpc).toHaveBeenCalledWith('get_admin_dashboard_analytics', {
      p_range: '90d',
      p_timezone: 'America/New_York',
    })
  })

  it('rejects unsupported ranges before querying analytics', async () => {
    const response = await GET(request('365d'))

    expect(response.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('does not expose analytics to non-admin users', async () => {
    mockIsAdminUser.mockResolvedValue(false)

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
