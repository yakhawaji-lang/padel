/**
 * Tournament split-payment deadline for UI: follows current club settings
 * (tournament king/social minutes) from booking lock time, aligned with server
 * bookingService.pickSplitPaymentDeadlineMinutes + computePaymentDeadlineFromMinutes.
 */

function bookingPayload(booking) {
  if (!booking || typeof booking !== 'object') return {}
  const d = booking.data
  if (d && typeof d === 'object') return d
  return booking
}

export function bookingIsTournamentForDeadline(booking) {
  const d = bookingPayload(booking)
  return (
    booking?.isTournament === true ||
    d.isTournament === true ||
    d.tournamentType != null ||
    d.tournament_type != null ||
    booking?.tournamentType != null
  )
}

/**
 * @param {object} settings — club.settings (camelCase or snake_case)
 * @param {object} booking
 */
export function pickSplitPaymentDeadlineMinutes(settings, booking) {
  const s = settings || {}
  const splitRaw =
    s.splitPaymentDeadlineMinutes ?? s.split_payment_deadline_minutes ?? 30
  const split = Math.max(1, Math.min(43200, parseInt(splitRaw, 10) || 30))
  const kingRaw =
    s.tournamentKingSplitPaymentDeadlineMinutes ??
    s.tournament_king_split_payment_deadline_minutes
  const socialRaw =
    s.tournamentSocialSplitPaymentDeadlineMinutes ??
    s.tournament_social_split_payment_deadline_minutes
  const king = parseInt(kingRaw, 10)
  const social = parseInt(socialRaw, 10)

  const d = bookingPayload(booking)
  const isTournament =
    booking?.isTournament === true ||
    d.isTournament === true ||
    d.tournamentType != null ||
    d.tournament_type != null ||
    booking?.tournamentType != null
  if (!isTournament) return split
  const tt = String(d.tournamentType || d.tournament_type || booking?.tournamentType || 'king').toLowerCase()
  if (tt === 'social') {
    const m = Number.isFinite(social) && social > 0 ? social : split
    return Math.max(1, Math.min(43200, m))
  }
  const m = Number.isFinite(king) && king > 0 ? king : split
  return Math.max(1, Math.min(43200, m))
}

export function parsePaymentDeadlineToMs(raw) {
  if (raw == null || raw === '') return null
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : null
}

function parseTimestampMs(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : null
}

/** Booking lock time (server sets locked_at at insert) — anchor for policy deadline */
export function getTournamentPaymentAnchorMs(booking) {
  if (!booking) return null
  return parseTimestampMs(booking.lockedAt ?? booking.locked_at)
}

function storedPaymentDeadlineMs(booking) {
  if (!booking) return null
  const raw =
    booking.paymentDeadlineAt ??
    booking.payment_deadline_at ??
    bookingPayload(booking).paymentDeadlineAt ??
    bookingPayload(booking).payment_deadline_at
  return parsePaymentDeadlineToMs(raw)
}

/**
 * Same end-of-day cap as server computePaymentDeadlineFromMinutes, but anchored at lock time.
 */
export function computeDeadlineMsFromAnchor(anchorMs, minutes, bookingDateYmd) {
  const mins = Math.max(1, Math.min(43200, parseInt(minutes, 10) || 30))
  let deadlineMs = anchorMs + mins * 60 * 1000
  const ymd = (bookingDateYmd || '').toString().trim().split('T')[0]
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const y = parseInt(m[1], 10)
    const mo = parseInt(m[2], 10)
    const d = parseInt(m[3], 10)
    if (y && mo && d) {
      const endOfBookingDay = new Date(y, mo - 1, d, 23, 59, 59, 999).getTime()
      if (!Number.isNaN(endOfBookingDay) && endOfBookingDay > anchorMs) {
        deadlineMs = Math.min(deadlineMs, endOfBookingDay)
      }
    }
  }
  return deadlineMs
}

/**
 * Effective deadline for tournament Teams-tab countdown: lock + current club tournament minutes.
 * Falls back to stored payment_deadline_at if lock is missing (so old rows still show something).
 * Uses live club settings so changing king/social tournament minutes updates the timer without DB backfill.
 */
export function effectiveTournamentSplitPaymentDeadlineMs(booking, clubSettings) {
  if (!booking) return null
  if (!bookingIsTournamentForDeadline(booking)) {
    return storedPaymentDeadlineMs(booking)
  }

  const storedMs = storedPaymentDeadlineMs(booking)
  const anchorMs = getTournamentPaymentAnchorMs(booking)
  const minutes = pickSplitPaymentDeadlineMinutes(clubSettings, booking)
  const dateYmd = booking.date || booking.startDate || bookingPayload(booking).date

  if (anchorMs == null) {
    return storedMs
  }

  return computeDeadlineMsFromAnchor(anchorMs, minutes, dateYmd)
}
