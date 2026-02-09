/**
 * PostgreSQL API client - replaces localStorage and IndexedDB calls.
 * All methods are async. Uses VITE_API_URL (default: http://localhost:4000) for backend.
 */

const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ??
  (typeof window !== 'undefined'
    ? (/localhost|127\.0\.0\.1/.test(window.location?.hostname || '') && ['3000', '5173', '5174'].includes(window.location?.port || ''))
      ? 'http://localhost:4000'
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

/** Retry on 502/503/504 (server slow/overloaded) - up to 4 retries, 3s delay */
const RETRY_STATUSES = [502, 503, 504]
function isRetryableError(e) {
  if (!e) return false
  if (RETRY_STATUSES.includes(e.status)) return true
  const msg = (e?.message || '').toLowerCase()
  return /50[234]|gateway timeout|timeout|bad gateway|service unavailable|failed to fetch|networkerror|network error/i.test(msg)
}
async function fetchWithRetry(path, options, maxRetries = 4) {
  let lastErr
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fetchJson(path, options)
    } catch (e) {
      lastErr = e
      if (isRetryableError(e) && i < maxRetries) {
        await new Promise(r => setTimeout(r, 3000))
        continue
      }
      throw e
    }
  }
  throw lastErr
}

// ---- Data API (reads from entities + app_settings tables, DB-only) ----

export async function getStore(key) {
  try {
    return await fetchJson(`/api/data/${encodeURIComponent(key)}`)
  } catch (e) {
    if (e.message?.includes('Not Found') || e.message?.includes('404') || e.message?.includes('fetch') || e.message?.includes('Failed')) {
      try {
        return await fetchJson(`/api/store/${encodeURIComponent(key)}`)
      } catch (_) {
        return null
      }
    }
    return null
  }
}

export async function getStoreBatch(keys) {
  if (!keys?.length) return {}
  try {
    return await fetchJson(`/api/data?keys=${keys.map(k => encodeURIComponent(k)).join(',')}`)
  } catch (e) {
    if (e.message?.includes('Not Found') || e.message?.includes('404') || e.message?.includes('fetch') || e.message?.includes('Failed')) {
      try {
        return await fetchJson(`/api/store?keys=${keys.map(k => encodeURIComponent(k)).join(',')}`)
      } catch (_) {
        return {}
      }
    }
    return {}
  }
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

// ---- Health check ----

export async function healthCheck() {
  try {
    const r = await fetch(`${API_URL}/api/health`)
    return r.ok && (await r.json())?.db === true
  } catch {
    return false
  }
}
