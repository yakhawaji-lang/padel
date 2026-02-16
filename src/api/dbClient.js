/**
 * PostgreSQL API client - replaces localStorage and IndexedDB calls.
 * All methods are async. Uses VITE_API_URL (default: http://localhost:4000) for backend.
 */

/** In dev (Vite on 3000/3001/etc): use '' so /api goes through Vite proxy to 4000. Avoids CORS and 404 when API not on same host. */
const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL !== undefined && import.meta.env?.VITE_API_URL !== '')
  ? import.meta.env.VITE_API_URL
  : (typeof window !== 'undefined'
    ? (/localhost|127\.0\.0\.1/.test(window.location?.hostname || '') && ['3000', '3001', '3002', '5173', '5174'].includes(window.location?.port || ''))
      ? ''
      : ''
    : 'http://localhost:4000')

/** ضبط دالة للحصول على بيانات المدخل (للتسجيل في audit_log) */
let _getDataActor = null
export function configureDataActor(getter) {
  _getDataActor = getter
}

function getDataActorHeaders() {
  const actor = typeof _getDataActor === 'function' ? _getDataActor() : null
  if (!actor) return {}
  const h = {}
  if (actor.actorType) h['X-Actor-Type'] = actor.actorType
  if (actor.actorId) h['X-Actor-Id'] = actor.actorId
  if (actor.actorName) h['X-Actor-Name'] = actor.actorName
  if (actor.clubId) h['X-Club-Id'] = actor.clubId
  return h
}

async function fetchJson(path, options = {}) {
  const actorHeaders = path.startsWith('/api/data') && (options.method === 'POST' || options.method === 'PUT') ? getDataActorHeaders() : {}
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...actorHeaders, ...options.headers }
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const e = new Error(err.error || res.statusText)
    e.status = res.status
    throw e
  }
  return res.json()
}

/** Retry only on server/gateway errors (502/503/504, 500 deadlock). Do NOT retry on client errors (e.g. ERR_INSUFFICIENT_RESOURCES) to avoid request storms. */
const RETRY_STATUSES = [502, 503, 504]
function isRetryableError(e) {
  if (!e) return false
  if (RETRY_STATUSES.includes(e.status)) return true
  const msg = (e?.message || '').toLowerCase()
  if (e.status === 500 && /deadlock|try restarting transaction/i.test(msg)) return true
  if (/insufficient_resources|failed to fetch|networkerror|network error/i.test(msg)) return false
  return /50[234]|gateway timeout|bad gateway|service unavailable/i.test(msg)
}

/** Browser ran out of sockets/resources; do not retry or fallback to /api/store to avoid request storm. */
const RESOURCE_BACKOFF_MS = 15000
let _resourceErrorBackoffUntil = 0
function isResourceExhaustionError(e) {
  if (!e) return false
  const msg = (e?.message || String(e)).toLowerCase()
  return /insufficient_resources|failed to fetch|load failed|networkerror|network error/i.test(msg)
}
function setResourceBackoff() {
  _resourceErrorBackoffUntil = Date.now() + RESOURCE_BACKOFF_MS
}
function isInResourceBackoff() {
  return Date.now() < _resourceErrorBackoffUntil
}
async function fetchWithRetry(path, options, maxRetries = 4) {
  let lastErr
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fetchJson(path, options)
    } catch (e) {
      lastErr = e
      if (isRetryableError(e) && i < maxRetries) {
        const isDeadlock = e.status === 500 && /deadlock|try restarting transaction/i.test(e?.message || '')
        const delay = isDeadlock ? 150 * (i + 1) : (e.status === 504 || (e?.message || '').toLowerCase().includes('timeout') ? 5000 : 3000)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw e
    }
  }
  throw lastErr
}

// ---- Data API (reads from entities + app_settings tables, DB-only) ----

const getStoreBatchInFlight = new Map()

export async function getStore(key) {
  if (isInResourceBackoff()) return null
  try {
    return await fetchWithRetry(`/api/data/${encodeURIComponent(key)}`)
  } catch (e) {
    if (isResourceExhaustionError(e)) {
      setResourceBackoff()
      return null
    }
    if (DATA_ENTITY_KEYS.includes(key)) return null
    if (e.status === 404 || (e.message && /not found|404/i.test(e.message))) {
      try {
        return await fetchWithRetry(`/api/store/${encodeURIComponent(key)}`)
      } catch (_) {
        return null
      }
    }
    if (RETRY_STATUSES.includes(e.status)) return null
    return null
  }
}

const DATA_ENTITY_KEYS = ['admin_clubs', 'all_members', 'padel_members', 'platform_admins']

export async function getStoreBatch(keys) {
  if (!keys?.length) return {}
  const keyStr = [...keys].sort().join(',')
  let promise = getStoreBatchInFlight.get(keyStr)
  if (promise) return promise
  const onlyEntityKeys = keys.length > 0 && keys.every(k => DATA_ENTITY_KEYS.includes(k))
  promise = (async () => {
    if (isInResourceBackoff()) return {}
    try {
      const url = `/api/data?keys=${keys.map(k => encodeURIComponent(k)).join(',')}`
      return await fetchWithRetry(url)
    } catch (e) {
      if (isResourceExhaustionError(e)) {
        setResourceBackoff()
        return {}
      }
      if (onlyEntityKeys) return {}
      if (e.status === 404 || (e.message && /not found|404/i.test(e.message))) {
        try {
          return await fetchWithRetry(`/api/store?keys=${keys.map(k => encodeURIComponent(k)).join(',')}`)
        } catch (_) {
          return {}
        }
      }
      if (RETRY_STATUSES.includes(e.status)) return {}
      return {}
    } finally {
      getStoreBatchInFlight.delete(keyStr)
    }
  })()
  getStoreBatchInFlight.set(keyStr, promise)
  return promise
}

export async function setStore(key, value) {
  try {
    return await fetchWithRetry('/api/data', {
      method: 'POST',
      body: JSON.stringify({ key, value })
    })
  } catch (e) {
    if (e?.message?.includes('Not Found') || e?.message?.includes('404')) {
      return fetchWithRetry('/api/store', {
        method: 'POST',
        body: JSON.stringify({ key, value })
      })
    }
    throw e
  }
}

export async function setStoreBatch(items) {
  if (!items?.length) return
  return fetchJson('/api/store/batch', {
    method: 'POST',
    body: JSON.stringify({ items })
  })
}

/** Permanently delete a club from the database. Requires normalized tables. */
export async function deleteClubPermanent(clubId) {
  return fetchJson('/api/data/club-delete-permanent', {
    method: 'POST',
    body: JSON.stringify({ clubId })
  })
}

/** Remove a member from one club in the database (explicit removal). Use when admin clicks "Remove from club". */
export async function removeMemberFromClubApi(memberId, clubId) {
  return fetchJson('/api/data/member-remove-from-club', {
    method: 'POST',
    body: JSON.stringify({ memberId, clubId })
  })
}

/** حفظ إعدادات نادٍ واحد في padel_db. يُرجع الإعدادات المحفوظة من القاعدة. */
export async function saveClubSettings(clubId, settings) {
  const toNum = (v, d) => (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v))) ? Number(v) : d
  const booking = {
    lockMinutes: toNum(settings.lockMinutes, 10),
    paymentDeadlineMinutes: toNum(settings.paymentDeadlineMinutes, 10),
    splitManageMinutes: toNum(settings.splitManageMinutes, 15),
    splitPaymentDeadlineMinutes: toNum(settings.splitPaymentDeadlineMinutes, 30),
    refundDays: toNum(settings.refundDays, 3),
    allowIncompleteBookings: !!settings.allowIncompleteBookings
  }
  const res = await fetchWithRetry('/api/data/club-settings', {
    method: 'POST',
    body: JSON.stringify({ clubId, settings, booking })
  })
  return res?.settings ?? null
}

// ---- Matches (replaces IndexedDB matches) ----

export async function getMatches(opts = {}) {
  const params = new URLSearchParams()
  if (opts.clubId) params.set('clubId', opts.clubId)
  if (opts.tournamentType) params.set('tournamentType', opts.tournamentType)
  if (opts.tournamentId != null) params.set('tournamentId', opts.tournamentId)
  const q = params.toString()
  return fetchJson(`/api/matches${q ? '?' + q : ''}`)
}

export async function saveMatch(match, tournamentType, tournamentId) {
  return fetchJson('/api/matches', {
    method: 'POST',
    body: JSON.stringify({ ...match, tournamentType, tournamentId })
  })
}

export async function deleteMatchesByTournament(clubId, tournamentId, tournamentType) {
  return fetchJson(
    `/api/matches?clubId=${encodeURIComponent(clubId)}&tournamentId=${tournamentId}&tournamentType=${encodeURIComponent(tournamentType)}`,
    { method: 'DELETE' }
  )
}

export async function deleteMatchesByDateAndType(clubId, date, tournamentType) {
  return fetchJson(
    `/api/matches/by-date?clubId=${encodeURIComponent(clubId)}&date=${encodeURIComponent(date)}&tournamentType=${encodeURIComponent(tournamentType)}`,
    { method: 'DELETE' }
  )
}

// ---- Member stats ----

export async function getMemberStats(opts = {}) {
  const params = new URLSearchParams()
  if (opts.memberId) params.set('memberId', opts.memberId)
  if (opts.clubId) params.set('clubId', opts.clubId)
  const q = params.toString()
  return fetchJson(`/api/member-stats${q ? '?' + q : ''}`)
}

export async function saveMemberStats(data) {
  return fetchJson('/api/member-stats', { method: 'POST', body: JSON.stringify(data) })
}

// ---- Tournament summaries ----

export async function getTournamentSummaries(clubId) {
  return fetchJson(`/api/tournament-summaries?clubId=${encodeURIComponent(clubId)}`)
}

export async function saveTournamentSummary(clubId, data) {
  return fetchJson('/api/tournament-summaries', {
    method: 'POST',
    body: JSON.stringify({ clubId, ...data })
  })
}

// ---- Password reset ----

export async function requestPasswordReset(email) {
  return fetchJson('/api/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email })
  })
}

export async function confirmPasswordReset(token, newPassword) {
  return fetchJson('/api/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword })
  })
}

export async function changeMemberPassword(memberId, currentPassword, newPassword) {
  return fetchJson('/api/password-reset/change', {
    method: 'POST',
    body: JSON.stringify({ memberId, currentPassword, newPassword })
  })
}

// ---- Bookings (lock, confirm, cancel) ----

export async function getBookingLocks(clubId, date) {
  const params = new URLSearchParams()
  if (clubId) params.set('clubId', clubId)
  if (date) params.set('date', date)
  const q = params.toString()
  return fetchJson(`/api/bookings/locks${q ? '?' + q : ''}`)
}

export async function acquireBookingLock({ clubId, courtId, date, startTime, endTime, memberId, lockMinutes }) {
  return fetchJson('/api/bookings/lock', {
    method: 'POST',
    body: JSON.stringify({ clubId, courtId, date, startTime, endTime, memberId, lockMinutes })
  })
}

export async function releaseBookingLock(lockId, clubId, date) {
  return fetchJson('/api/bookings/release-lock', {
    method: 'POST',
    body: JSON.stringify({ lockId, clubId, date })
  })
}

export async function confirmBooking({ lockId, clubId, courtId, date, startTime, endTime, memberId, memberName, totalAmount, paymentMethod, paymentShares, idempotencyKey }) {
  return fetchJson('/api/bookings/confirm', {
    method: 'POST',
    body: JSON.stringify({ lockId, clubId, date, startTime, endTime, memberId, memberName, totalAmount, paymentMethod, paymentShares, idempotencyKey, courtId })
  })
}

export async function cancelBooking(bookingId) {
  return fetchJson('/api/bookings/cancel', {
    method: 'POST',
    body: JSON.stringify({ bookingId })
  })
}

export async function markPayAtClub(bookingId, clubId) {
  return fetchJson('/api/bookings/mark-pay-at-club', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId })
  })
}

export async function cancelBookingLock(lockId) {
  return fetchJson('/api/bookings/cancel', {
    method: 'POST',
    body: JSON.stringify({ lockId })
  })
}

// ---- Favorites ----
export async function getFavoriteMembers(memberId, clubId) {
  const params = new URLSearchParams({ memberId, clubId })
  return fetchJson(`/api/bookings/favorites?${params}`)
}

export async function addFavoriteMember(memberId, clubId, favoriteMemberId) {
  return fetchJson('/api/bookings/favorites', {
    method: 'POST',
    body: JSON.stringify({ memberId, clubId, favoriteMemberId })
  })
}

export async function removeFavoriteMember(memberId, clubId, favoriteMemberId) {
  const params = new URLSearchParams({ memberId, clubId, favoriteMemberId })
  return fetchJson(`/api/bookings/favorites?${params}`, { method: 'DELETE' })
}

// ---- Club join ----
export async function joinClub(clubId, memberId) {
  return fetchJson('/api/clubs/join', {
    method: 'POST',
    body: JSON.stringify({ clubId, memberId })
  })
}

// ---- Record payment ----
export async function recordPayment({ shareId, inviteToken, clubId, paymentReference }) {
  return fetchJson('/api/bookings/record-payment', {
    method: 'POST',
    body: JSON.stringify({ shareId, inviteToken, clubId, paymentReference })
  })
}

// ---- Invite ----
export async function getInviteByToken(token) {
  return fetchJson(`/api/bookings/invite/${encodeURIComponent(token)}`)
}

// ---- Health check ----

export async function healthCheck() {
  try {
    const r = await fetch(`${API_URL}/api/health`)
    return r.ok && (await r.json())?.db === true
  } catch {
    return false
  }
}
