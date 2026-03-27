/**
 * Simple in-memory sliding window rate limiter.
 *
 * Suitable for single-instance self-hosted deployments (Docker).
 * For multi-instance deployments, swap the store for a Redis-backed
 * solution such as @upstash/ratelimit.
 */

interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

/** Prune expired entries to prevent unbounded memory growth. */
let lastCleanup = Date.now()
function maybeCleanup() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Unix ms timestamp when the window resets */
  reset: number
}

/**
 * Check whether `identifier` is within the allowed rate.
 *
 * @param identifier - Unique key (e.g. `"ip:1.2.3.4"`, `"user:abc"`)
 * @param limit      - Maximum requests allowed per window
 * @param windowMs   - Window duration in milliseconds
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  maybeCleanup()
  const now = Date.now()
  const entry = store.get(identifier)

  if (!entry || entry.resetAt <= now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, reset: now + windowMs }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, reset: entry.resetAt }
  }

  entry.count += 1
  return { allowed: true, remaining: limit - entry.count, reset: entry.resetAt }
}
