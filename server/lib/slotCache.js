/**
 * In-memory cache for booking slots/locks - reduces DB load
 */
const cache = new Map()
const TTL_MS = 30 * 1000 // 30 seconds

function cacheKey(clubId, date) {
  return `slots:${clubId}:${date}`
}

export function getCachedLocks(clubId, date) {
  const key = cacheKey(clubId, date)
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.data
}

export function setCachedLocks(clubId, date, data) {
  const key = cacheKey(clubId, date)
  cache.set(key, { data, at: Date.now() })
}

export function invalidateLocks(clubId, date) {
  cache.delete(cacheKey(clubId, date))
  if (!date) {
    for (const k of cache.keys()) {
      if (k.startsWith(`slots:${clubId}:`)) cache.delete(k)
    }
  }
}
