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

/** تحويل مسار Gallery إلى URL كامل عند الحاجة (عندما يكون API على دومين مختلف) */
export function getImageUrl(value) {
  if (!value || typeof value !== 'string') return value
  if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('/api/gallery/') && API_URL) return `${API_URL.replace(/\/$/, '')}${value}`
  return value
}

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

function needsDataActorHeaders(path, method) {
  const m = method || 'GET'
  if (path.startsWith('/api/data') && (m === 'POST' || m === 'PUT')) return true
  if (m === 'POST' && path === '/api/bookings/admin-purge') return true
  if (m === 'POST' && path === '/api/invoices/purge') return true
  if (m === 'POST' && path === '/api/bookings/admin-fulfill-member-refund') return true
  if (m === 'POST' && path === '/api/bookings/admin-fulfill-member-share-refund') return true
  if (m === 'POST' && path === '/api/bookings/admin-extend-split-deadline') return true
  if (m === 'POST' && path === '/api/bookings/admin-import-expired-split-credits') return true
  if (m === 'POST' && path === '/api/bookings/record-payment') return true
  if (m === 'POST' && path === '/api/bookings/set-allow-co-add-split') return true
  if (m === 'POST' && path === '/api/bookings/record-remainder-payment') return true
  return false
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
let _globalSavingPending = 0
const _globalSavingListeners = new Set()

function isMutationMethod(method) {
  return MUTATION_METHODS.has(String(method || 'GET').toUpperCase())
}

function emitGlobalSaving() {
  const snapshot = {
    pendingCount: Math.max(0, _globalSavingPending),
    isSaving: _globalSavingPending > 0,
    changedAt: Date.now(),
  }
  _globalSavingListeners.forEach((fn) => {
    try {
      fn(snapshot)
    } catch {
      // ignore listener failures
    }
  })
}

function trackGlobalSavingStart() {
  _globalSavingPending += 1
  emitGlobalSaving()
}

function trackGlobalSavingEnd() {
  _globalSavingPending = Math.max(0, _globalSavingPending - 1)
  emitGlobalSaving()
}

export function subscribeGlobalSaving(listener) {
  if (typeof listener !== 'function') return () => {}
  _globalSavingListeners.add(listener)
  listener({
    pendingCount: Math.max(0, _globalSavingPending),
    isSaving: _globalSavingPending > 0,
    changedAt: Date.now(),
  })
  return () => {
    _globalSavingListeners.delete(listener)
  }
}

async function fetchJson(path, options = {}) {
  const { __skipGlobalSaving = false, ...fetchOptions } = options || {}
  const method = String(fetchOptions.method || 'GET').toUpperCase()
  const actorHeaders = needsDataActorHeaders(path, method) ? getDataActorHeaders() : {}
  const shouldTrackSaving = isMutationMethod(method) && !__skipGlobalSaving
  if (shouldTrackSaving) trackGlobalSavingStart()
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers: { 'Content-Type': 'application/json', ...actorHeaders, ...fetchOptions.headers }
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const e = new Error(err.error || res.statusText)
      e.status = res.status
      throw e
    }
    return res.json()
  } finally {
    if (shouldTrackSaving) trackGlobalSavingEnd()
  }
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

/** Set or unset a member as coach for a club. Use when admin toggles coach status. */
export async function setMemberCoachApi(memberId, clubId, isCoach) {
  return fetchJson('/api/data/member-set-coach', {
    method: 'POST',
    body: JSON.stringify({ memberId, clubId, isCoach })
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

export async function sendWhatsAppTestMessage(phone, text) {
  return fetchJson('/api/whatsapp-webhook/send', {
    method: 'POST',
    body: JSON.stringify({ phone, text })
  })
}

export async function sendSmsTestMessage(phone, text) {
  return fetchJson('/api/sms-webhook/send', {
    method: 'POST',
    body: JSON.stringify({ phone, text })
  })
}

/** Send email test (admin) */
export async function sendEmailTest(to, subject, body) {
  return fetchJson('/api/email/send', {
    method: 'POST',
    body: JSON.stringify({ to, subject, body })
  })
}

/** Send 4-digit verification code to email */
export async function sendEmailVerificationCode(email, purpose) {
  return fetchJson('/api/email/send-verification-code', {
    method: 'POST',
    body: JSON.stringify({ email, purpose })
  })
}

/** Verify 4-digit code */
export async function verifyEmailCode(email, code) {
  return fetchJson('/api/email/verify-code', {
    method: 'POST',
    body: JSON.stringify({ email, code })
  })
}

/** Send welcome email to new member after registration */
export async function sendWelcomeMemberEmail(email, name) {
  try {
    await fetchJson('/api/email/send-welcome-member', {
      method: 'POST',
      body: JSON.stringify({ email, name })
    })
  } catch (e) {
    console.warn('[sendWelcomeMemberEmail]', e?.message)
  }
}

/** Send welcome email when member joins club */
export async function sendWelcomeClubJoinEmail(email, memberName, clubName) {
  try {
    await fetchJson('/api/email/send-welcome-club-join', {
      method: 'POST',
      body: JSON.stringify({ email, memberName, clubName })
    })
  } catch (e) {
    console.warn('[sendWelcomeClubJoinEmail]', e?.message)
  }
}

/** Send club email verification code */
export async function sendClubEmailVerificationEmail(email) {
  return fetchJson('/api/email/send-club-verification', {
    method: 'POST',
    body: JSON.stringify({ email })
  })
}

/** Verify club email with code */
export async function verifyClubEmail(email, code, clubId) {
  return fetchJson('/api/email/verify-club-email', {
    method: 'POST',
    body: JSON.stringify({ email, code, clubId })
  })
}

/** Send registration welcome WhatsApp (fire-and-forget, don't block UI) */
export async function sendRegistrationWelcome(phone, name) {
  try {
    await fetchJson('/api/whatsapp-webhook/welcome', {
      method: 'POST',
      body: JSON.stringify({ phone: phone || '', name: name || '' })
    })
  } catch (e) {
    console.warn('[sendRegistrationWelcome]', e?.message)
  }
}

/** Upload homepage image (banner or gallery-1..6). image = data URL (data:image/png;base64,...) */
export async function uploadHomepageImage(key, image) {
  return fetchJson('/api/settings/homepage-image', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ key, image })
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

export async function confirmBooking({ lockId, clubId, courtId, date, startTime, endTime, memberId, memberName, totalAmount, paymentMethod, initiatorPaymentMethod, paymentShares, idempotencyKey, remainderPaymentMethod }) {
  return fetchJson('/api/bookings/confirm', {
    method: 'POST',
    body: JSON.stringify({ lockId, clubId, date, startTime, endTime, memberId, memberName, totalAmount, paymentMethod, initiatorPaymentMethod, paymentShares, idempotencyKey, courtId, remainderPaymentMethod })
  })
}

export async function getWalletBalance(clubId, memberId) {
  const q = new URLSearchParams({ clubId: String(clubId), memberId: String(memberId) })
  return fetchJson(`/api/bookings/wallet-balance?${q}`)
}

export async function memberBookingSelfServiceQuote({ bookingId, clubId, memberId }) {
  return fetchJson('/api/bookings/member-self-service-quote', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, memberId }),
  })
}

/** Split participant: quote refund for own paid share (same policy as member-request-share-refund) */
export async function memberShareSelfServiceQuote({ bookingId, clubId, memberId, shareId, inviteToken, phone }) {
  return fetchJson('/api/bookings/member-share-self-service-quote', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, memberId, shareId, inviteToken, phone }),
  })
}

export async function memberRescheduleBooking(payload) {
  return fetchJson('/api/bookings/member-reschedule-booking', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function memberRefundRequest({ bookingId, clubId, memberId, refundRoute }) {
  return fetchJson('/api/bookings/member-refund-request', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, memberId, refundRoute }),
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

export async function markSharePaidAtClub({ shareId, inviteToken, clubId }) {
  return fetchJson('/api/bookings/mark-share-paid-at-club', {
    method: 'POST',
    body: JSON.stringify({ shareId, inviteToken, clubId })
  })
}

export async function updateSharePaymentMethod({ inviteToken, clubId, paymentMethod }) {
  return fetchJson('/api/bookings/update-share-payment-method', {
    method: 'PATCH',
    body: JSON.stringify({ inviteToken, clubId, paymentMethod })
  })
}

export async function createCoachTrainingSlots({ clubId, courtId, dates, startTime, endTime, pricePerHour, maxTrainees, coachId }) {
  return fetchJson('/api/bookings/coach-training', {
    method: 'POST',
    body: JSON.stringify({ clubId, courtId, dates, startTime, endTime, pricePerHour, maxTrainees, coachId })
  })
}

/** Join a coach training slot as trainee - uses coach's price */
export async function joinTrainingSlot({ bookingId, clubId, memberId, memberName, paymentStyle, paymentMethod, paymentShares }) {
  return fetchJson('/api/bookings/join-training', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, memberId, memberName, paymentStyle, paymentMethod, paymentShares })
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

export async function recordCoachTrainingInvites({ clubId, bookingId, coachId, memberIds }) {
  return fetchJson('/api/bookings/coach-training-invite', {
    method: 'POST',
    body: JSON.stringify({ clubId, bookingId, coachId, memberIds })
  })
}

export async function getMyTrainingInvites(memberId) {
  const params = new URLSearchParams({ memberId })
  return fetchJson(`/api/bookings/my-training-invites?${params}`)
}

export async function dismissTrainingInvite(inviteId, memberId) {
  return fetchJson('/api/bookings/dismiss-training-invite', {
    method: 'POST',
    body: JSON.stringify({ inviteId, memberId })
  })
}

// ---- Club join ----
export async function joinClub(clubId, memberId) {
  return fetchJson('/api/clubs/join', {
    method: 'POST',
    body: JSON.stringify({ clubId, memberId })
  })
}

// ---- Record payment ----
export async function recordPayment({ shareId, inviteToken, clubId, paymentReference, paymentMethod }) {
  return fetchJson('/api/bookings/record-payment', {
    method: 'POST',
    body: JSON.stringify({ shareId, inviteToken, clubId, paymentReference, paymentMethod })
  })
}

export async function adminRefundShare({ shareId, inviteToken, clubId, refundMethod, refundReference, refundNotes, removeFromBooking }) {
  return fetchJson('/api/bookings/admin-refund-share', {
    method: 'POST',
    body: JSON.stringify({ shareId, inviteToken, clubId, refundMethod, refundReference, refundNotes, removeFromBooking })
  })
}

export async function adminRefundBookingFull({ bookingId, clubId, refundMethod, refundReference, refundNotes }) {
  return fetchJson('/api/bookings/admin-refund-booking-full', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, refundMethod, refundReference, refundNotes })
  })
}

/** Club staff: complete member cancel/refund (cash handed, wallet credit, or electronic reversal recorded) */
export async function adminFulfillMemberRefund({ bookingId, clubId, fulfillment }) {
  return fetchJson('/api/bookings/admin-fulfill-member-refund', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, fulfillment }),
  })
}

export async function acknowledgeShareRefund({ shareId, inviteToken, clubId, memberId, phone }) {
  return fetchJson('/api/bookings/acknowledge-share-refund', {
    method: 'POST',
    body: JSON.stringify({ shareId, inviteToken, clubId, memberId, phone })
  })
}

export async function addSplitParticipants({ bookingId, clubId, memberId, paymentShares }) {
  return fetchJson('/api/bookings/add-split-participants', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, memberId, paymentShares })
  })
}

/** Booker: allow other split participants to add people to the payment split */
export async function setAllowCoAddSplit({ bookingId, clubId, memberId, allow }) {
  return fetchJson('/api/bookings/set-allow-co-add-split', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, memberId, allow: !!allow })
  })
}

/** Booker or participant: pay all unpaid shares in one step (wallet / at_club / electronic ref) */
export async function recordRemainderPayment({ bookingId, clubId, memberId, paymentMethod, paymentReference }) {
  return fetchJson('/api/bookings/record-remainder-payment', {
    method: 'POST',
    body: JSON.stringify({
      bookingId,
      clubId,
      memberId,
      paymentMethod,
      ...(paymentReference != null && paymentReference !== '' ? { paymentReference } : {})
    })
  })
}

/** Booker: correct guest phone — new invite token and pay URL (unpaid shares only) */
export async function bookerUpdateSharePhone({ bookingId, clubId, memberId, shareId, inviteToken, phone }) {
  return fetchJson('/api/bookings/booker-update-share-phone', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, memberId, shareId, inviteToken, phone })
  })
}

/** Booker: remove a participant share before they pay */
export async function bookerRemovePendingShare({ bookingId, clubId, memberId, shareId, inviteToken }) {
  return fetchJson('/api/bookings/booker-remove-pending-share', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, memberId, shareId, inviteToken })
  })
}

/** Split participant: leave before paying (removes own share) */
export async function memberRemoveOwnShare({ bookingId, clubId, memberId, shareId, inviteToken, phone }) {
  return fetchJson('/api/bookings/member-remove-own-share', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, memberId, shareId, inviteToken, phone })
  })
}

/** Split participant: paid share — request refund (wallet / cash at club / card); club fulfills via admin */
export async function memberRequestShareRefund({ bookingId, clubId, memberId, shareId, inviteToken, refundRoute, phone }) {
  return fetchJson('/api/bookings/member-request-share-refund', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId, memberId, shareId, inviteToken, refundRoute, phone })
  })
}

/** Club staff: complete split-participant refund after member request */
export async function adminFulfillMemberShareRefund({ shareId, clubId, fulfillment }) {
  return fetchJson('/api/bookings/admin-fulfill-member-share-refund', {
    method: 'POST',
    body: JSON.stringify({ shareId, clubId, fulfillment })
  })
}

/** أدمن النادي: تمديد مهلة التقسيم، أو إعادة تفعيل حجز منتهٍ (expired) مع مدة بالدقائق */
export async function adminExtendSplitPaymentDeadline({ bookingId, clubId, extendMinutes }) {
  return fetchJson('/api/bookings/admin-extend-split-deadline', {
    method: 'POST',
    body: JSON.stringify({
      bookingId,
      clubId,
      ...(extendMinutes != null && extendMinutes !== '' ? { extendMinutes } : {}),
    }),
  })
}

/** Club admin: credit member wallets for paid shares on an expired (deadline) split booking; void share invoices */
export async function adminImportExpiredSplitCreditsToWallets({ bookingId, clubId }) {
  return fetchJson('/api/bookings/admin-import-expired-split-credits', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId }),
  })
}

// ---- Invite ----
export async function getInviteByToken(token) {
  const { normalizeInviteTokenParam } = await import('../utils/paymentShareDeepLink.js')
  const t = normalizeInviteTokenParam(token)
  if (!t) {
    const e = new Error('Token required')
    e.status = 400
    throw e
  }
  return fetchJson(`/api/bookings/invite/${encodeURIComponent(t)}`)
}

/** After pay-invite quick register: link booking_payment_shares row to the new member */
export async function claimInviteShare({ inviteToken, clubId, memberId, phone, memberName }) {
  return fetchJson('/api/bookings/claim-invite-share', {
    method: 'POST',
    body: JSON.stringify({ inviteToken, clubId, memberId, phone, memberName })
  })
}

/** Get invite token for member's share (when not in cached booking data) */
export async function getShareInviteToken(bookingId, clubId, memberId) {
  const params = new URLSearchParams({ bookingId, clubId, memberId })
  return fetchJson(`/api/bookings/share-invite?${params}`)
}

/** Get a single booking by ID (for payment page) */
export async function getBookingById(bookingId) {
  return fetchJson(`/api/bookings/${encodeURIComponent(bookingId)}`)
}

/** Complete payment for a pending_payment booking (simulated) */
export async function completePayment({ bookingId, clubId }) {
  return fetchJson('/api/bookings/complete-payment', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId })
  })
}

/** Club staff: full booking paid at club — confirm cash received, mark paid, issue invoice */
export async function confirmPaidAtClubFull({ bookingId, clubId }) {
  return fetchJson('/api/bookings/confirm-paid-at-club-full', {
    method: 'POST',
    body: JSON.stringify({ bookingId, clubId }),
  })
}

export async function adminPurgeBooking({ clubId, bookingId }) {
  return fetchJson('/api/bookings/admin-purge', {
    method: 'POST',
    body: JSON.stringify({ clubId, bookingId }),
  })
}

/** قائمة فواتير النادي (يتطلب تهجير جداول الفوترة على السيرفر) */
export async function fetchClubInvoices(clubId, { from, to, limit = 100, offset = 0 } = {}) {
  const q = new URLSearchParams({ clubId: String(clubId) })
  if (from) q.set('from', from)
  if (to) q.set('to', to)
  if (limit != null) q.set('limit', String(limit))
  if (offset != null) q.set('offset', String(offset))
  return fetchJson(`/api/invoices?${q}`)
}

export async function fetchClubInvoiceDetail(clubId, publicId) {
  const q = new URLSearchParams({ clubId: String(clubId) })
  return fetchJson(`/api/invoices/${encodeURIComponent(publicId)}?${q}`)
}

/** Club staff: permanently delete invoice row and related lines/payments in DB */
export async function adminPurgeClubInvoice({ clubId, publicId }) {
  return fetchJson('/api/invoices/purge', {
    method: 'POST',
    body: JSON.stringify({ clubId, publicId }),
  })
}

// ---- Phone change verification ----
export async function sendPhoneChangeCode(memberId, newPhone) {
  return fetchJson('/api/email/send-phone-change-code', {
    method: 'POST',
    body: JSON.stringify({ memberId, newPhone })
  })
}

export async function verifyPhoneChange(memberId, newPhone, code) {
  return fetchJson('/api/email/verify-phone-change', {
    method: 'POST',
    body: JSON.stringify({ memberId, newPhone, code })
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
