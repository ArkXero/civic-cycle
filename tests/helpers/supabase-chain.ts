import { vi } from 'vitest'

/**
 * Build a Supabase query chain stub that resolves to { data, error }.
 * Supports chained .select/.insert/.update/.delete/.eq/.single/.in/.order calls.
 * The chain is also thenable so `await chain` resolves to result directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeChain(result: { data: unknown; error: unknown }): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    then: (resolve: (v: unknown) => void) => resolve(result),
    catch: () => Promise.resolve(result),
  }
  return chain
}
