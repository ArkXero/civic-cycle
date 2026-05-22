import { vi } from 'vite-plus/test'

/**
 * Build a Supabase query chain stub that resolves to { data, error }.
 * Supports chained .select/.insert/.update/.delete/.eq/.single/.in/.order calls.
 * The chain is also thenable so `await chain` resolves to result directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeChain(result: { data: unknown; error: unknown }): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = Promise.resolve(result)
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.upsert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(result)
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  chain.in = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockResolvedValue(result)
  return chain
}
