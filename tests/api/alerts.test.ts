import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ───────────────────────────────────────────────────────────────────
// Must be declared before any imports that depend on them.

const mockAdminFrom = vi.fn()
const mockUserFrom = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockUserFrom,
    }),
}))

// Import route handlers AFTER mocks are in place
import { GET, POST } from '@/app/api/alerts/route'
import { DELETE, PATCH } from '@/app/api/alerts/[id]/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a Supabase query chain stub that resolves to { data, error }.
 * Supports chained .select/.insert/.update/.delete/.eq/.single/.in/.order calls.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChain(result: { data: unknown; error: unknown }): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    // Thenability: `await chain` resolves to result
    then: (resolve: (v: unknown) => void) => resolve(result),
    catch: () => Promise.resolve(result),
  }
  return chain
}

function makeJsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const fakeUser = { id: 'user-uuid-1', email: 'test@example.com' }

const fakeAlert = {
  id: 'alert-uuid-1',
  user_id: 'user-uuid-1',
  keyword: 'budget',
  bodies: [],
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

// ─── GET /api/alerts ─────────────────────────────────────────────────────────

describe('GET /api/alerts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await GET()

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when getUser returns an auth error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('jwt expired') })

    const res = await GET()

    expect(res.status).toBe(401)
  })

  it('returns the list of alerts for the authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockUserFrom.mockReturnValue(makeChain({ data: [fakeAlert], error: null }))

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([fakeAlert])
  })

  it('returns an empty array when user has no alerts', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockUserFrom.mockReturnValue(makeChain({ data: [], error: null }))

    const res = await GET()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns 500 when the database query fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockUserFrom.mockReturnValue(makeChain({ data: null, error: new Error('db error') }))

    const res = await GET()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch alerts')
  })
})

// ─── POST /api/alerts ────────────────────────────────────────────────────────

describe('POST /api/alerts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const req = makeJsonRequest('http://localhost/api/alerts', 'POST', { keyword: 'budget' })
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 when keyword is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

    const req = makeJsonRequest('http://localhost/api/alerts', 'POST', {})
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation error')
  })

  it('returns 400 when keyword is too short (< 2 chars)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

    const req = makeJsonRequest('http://localhost/api/alerts', 'POST', { keyword: 'x' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation error')
    expect(body.message).toMatch(/at least 2 characters/i)
  })

  it('returns 400 when keyword exceeds 100 chars', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

    const req = makeJsonRequest('http://localhost/api/alerts', 'POST', {
      keyword: 'a'.repeat(101),
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 409 when a duplicate keyword alert already exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    // First query: duplicate check returns existing record
    mockUserFrom.mockReturnValueOnce(makeChain({ data: { id: 'existing-id' }, error: null }))

    const req = makeJsonRequest('http://localhost/api/alerts', 'POST', { keyword: 'budget' })
    const res = await POST(req)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Duplicate alert')
    expect(body.message).toContain('already have an alert')
  })

  it('creates alert, stores keyword as lowercase, and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    // First: duplicate check → no existing
    mockUserFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('no rows') }))
    // Second: insert → new alert
    mockUserFrom.mockReturnValueOnce(makeChain({ data: fakeAlert, error: null }))

    const req = makeJsonRequest('http://localhost/api/alerts', 'POST', { keyword: 'Budget' })
    const res = await POST(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toEqual(fakeAlert)
  })

  it('defaults bodies to [] when not provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockUserFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('no rows') }))
    const insertChain = makeChain({ data: { ...fakeAlert, bodies: [] }, error: null })
    mockUserFrom.mockReturnValueOnce(insertChain)

    const req = makeJsonRequest('http://localhost/api/alerts', 'POST', { keyword: 'budget' })
    await POST(req)

    // Verify insert was called with bodies: []
    const insertCall = insertChain.insert.mock.calls[0][0]
    expect(insertCall.bodies).toEqual([])
  })

  it('accepts bodies array when provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockUserFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('no rows') }))
    const insertChain = makeChain({
      data: { ...fakeAlert, bodies: ['FCPS School Board'] },
      error: null,
    })
    mockUserFrom.mockReturnValueOnce(insertChain)

    const req = makeJsonRequest('http://localhost/api/alerts', 'POST', {
      keyword: 'budget',
      bodies: ['FCPS School Board'],
    })
    await POST(req)

    const insertCall = insertChain.insert.mock.calls[0][0]
    expect(insertCall.bodies).toEqual(['FCPS School Board'])
  })

  it('returns 500 when the insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockUserFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('no rows') }))
    mockUserFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('db error') }))

    const req = makeJsonRequest('http://localhost/api/alerts', 'POST', { keyword: 'budget' })
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to create alert')
  })

  it('sets is_active to true by default on insert', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockUserFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('no rows') }))
    const insertChain = makeChain({ data: fakeAlert, error: null })
    mockUserFrom.mockReturnValueOnce(insertChain)

    const req = makeJsonRequest('http://localhost/api/alerts', 'POST', { keyword: 'budget' })
    await POST(req)

    const insertCall = insertChain.insert.mock.calls[0][0]
    expect(insertCall.is_active).toBe(true)
  })
})

// ─── DELETE /api/alerts/[id] ─────────────────────────────────────────────────

describe('DELETE /api/alerts/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeDeleteRequest(id = 'alert-uuid-1'): [NextRequest, { params: Promise<{ id: string }> }] {
    const req = new NextRequest(`http://localhost/api/alerts/${id}`, { method: 'DELETE' })
    return [req, { params: Promise.resolve({ id }) }]
  }

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const [req, ctx] = makeDeleteRequest()
    const res = await DELETE(req, ctx)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 404 when alert does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    // adminClient.from → fetch alert → not found
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('not found') }))

    const [req, ctx] = makeDeleteRequest('nonexistent-id')
    const res = await DELETE(req, ctx)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns 403 when alert belongs to a different user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    // Fetch returns alert owned by different user
    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: { id: 'alert-uuid-1', user_id: 'other-user-id' }, error: null }),
    )

    const [req, ctx] = makeDeleteRequest()
    const res = await DELETE(req, ctx)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('deletes alert and returns { success: true } for owner', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    // 1. fetch alert (ownership check)
    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: { id: 'alert-uuid-1', user_id: fakeUser.id }, error: null }),
    )
    // 2. delete
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: null }))

    const [req, ctx] = makeDeleteRequest()
    const res = await DELETE(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when delete query fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: { id: 'alert-uuid-1', user_id: fakeUser.id }, error: null }),
    )
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('db error') }))

    const [req, ctx] = makeDeleteRequest()
    const res = await DELETE(req, ctx)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to delete alert')
  })
})

// ─── PATCH /api/alerts/[id] ──────────────────────────────────────────────────

describe('PATCH /api/alerts/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  function makePatchRequest(
    id = 'alert-uuid-1',
    body?: unknown,
  ): [NextRequest, { params: Promise<{ id: string }> }] {
    const req = makeJsonRequest(`http://localhost/api/alerts/${id}`, 'PATCH', body)
    return [req, { params: Promise.resolve({ id }) }]
  }

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const [req, ctx] = makePatchRequest('alert-uuid-1', { is_active: false })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 when is_active is not a boolean', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

    const [req, ctx] = makePatchRequest('alert-uuid-1', { is_active: 'yes' })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation error')
    expect(body.message).toContain('boolean')
  })

  it('returns 400 when is_active is missing from body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

    const [req, ctx] = makePatchRequest('alert-uuid-1', {})
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(400)
  })

  it('returns 404 when alert does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('not found') }))

    const [req, ctx] = makePatchRequest('nonexistent-id', { is_active: false })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('returns 403 when alert belongs to a different user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: { id: 'alert-uuid-1', user_id: 'other-user' }, error: null }),
    )

    const [req, ctx] = makePatchRequest('alert-uuid-1', { is_active: false })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('toggles alert to inactive and returns updated record', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    const updatedAlert = { ...fakeAlert, is_active: false }

    // 1. Ownership fetch
    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: { id: 'alert-uuid-1', user_id: fakeUser.id }, error: null }),
    )
    // 2. Update
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: updatedAlert, error: null }))

    const [req, ctx] = makePatchRequest('alert-uuid-1', { is_active: false })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_active).toBe(false)
  })

  it('toggles alert to active and returns updated record', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })
    const updatedAlert = { ...fakeAlert, is_active: true }

    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: { id: 'alert-uuid-1', user_id: fakeUser.id }, error: null }),
    )
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: updatedAlert, error: null }))

    const [req, ctx] = makePatchRequest('alert-uuid-1', { is_active: true })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_active).toBe(true)
  })

  it('returns 500 when the update query fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

    mockAdminFrom.mockReturnValueOnce(
      makeChain({ data: { id: 'alert-uuid-1', user_id: fakeUser.id }, error: null }),
    )
    mockAdminFrom.mockReturnValueOnce(makeChain({ data: null, error: new Error('db error') }))

    const [req, ctx] = makePatchRequest('alert-uuid-1', { is_active: false })
    const res = await PATCH(req, ctx)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to update alert')
  })
})
