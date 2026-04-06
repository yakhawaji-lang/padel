/**
 * Resolve monetary amount for booking_payment_shares when DB `amount` is 0
 * (tournament roster fees, split remainder) — aligned with client effectiveShareAmount / invite flow.
 */
import { query } from '../db/pool.js'

export function digitsOnlyPhoneLike(raw) {
  return String(raw || '').replace(/\D/g, '')
}

export function parseBookingJsonData(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return { ...raw }
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/**
 * Pending guest / member tournament fee from clubs.tournament_data (kingStateByTournamentId / socialStateByTournamentId).
 */
export function feeFromClubTournamentDataForShare(tournamentDataRaw, bookingId, tournamentTypeLower, shareLike) {
  let td = tournamentDataRaw
  if (!td) return null
  if (typeof td === 'string') {
    try {
      td = JSON.parse(td || '{}')
    } catch {
      return null
    }
  }
  if (!td || typeof td !== 'object') return null
  const bid = String(bookingId || '').trim()
  if (!bid) return null
  const tt = String(tournamentTypeLower || 'king').toLowerCase()
  const map = tt === 'social' ? td.socialStateByTournamentId || {} : td.kingStateByTournamentId || {}
  const state = map[bid]
  if (!state?.teams || !Array.isArray(state.teams)) return null
  const sharePhone = digitsOnlyPhoneLike(shareLike.phone)
  const shareTok = String(shareLike.invite_token || shareLike.inviteToken || '').trim()
  const shareMem = String(shareLike.member_id || shareLike.memberId || '').trim()
  for (const team of state.teams) {
    for (const g of team.pendingFeeGuests || []) {
      const gTok = g.inviteToken != null ? String(g.inviteToken).trim() : ''
      if (shareTok && gTok && shareTok === gTok) {
        const f = parseFloat(g.fee)
        if (Number.isFinite(f) && f > 0.009) return f
      }
      const gd = digitsOnlyPhoneLike(g.phoneDisplay)
      if (sharePhone.length >= 8 && gd === sharePhone) {
        const f = parseFloat(g.fee)
        if (Number.isFinite(f) && f > 0.009) return f
      }
    }
    const mp = team.memberTournamentPayments || {}
    if (shareMem && mp[shareMem] && typeof mp[shareMem] === 'object') {
      const f = parseFloat(mp[shareMem].fee)
      if (Number.isFinite(f) && f > 0.009) return f
    }
  }
  return null
}

export function effectiveShareAmountFromDbRows(bookingTotal, allShareRows, targetRow) {
  const active = (allShareRows || []).filter((s) => !s.removed_at)
  const direct = parseFloat(targetRow.amount) || 0
  if (direct > 0.009) return Math.round(direct * 100) / 100
  const zeros = active.filter((s) => (parseFloat(s.amount) || 0) <= 0.009)
  if (zeros.length === 0) return 0
  const allocated = active.reduce((sum, s) => {
    const v = parseFloat(s.amount) || 0
    return sum + (v > 0.009 ? v : 0)
  }, 0)
  const remainder = Math.max(0, Math.round((bookingTotal - allocated) * 100) / 100)
  if (remainder <= 0.009) return 0
  return Math.round((remainder / zeros.length) * 100) / 100
}

/**
 * @param {object} shareRow — snake_case fields from DB or camelCase from API
 * @param {{ bookingId: string, bookingTotal: number, bookingDataParsed: object, tournamentDataRaw: any, allShareRows: object[] }} ctx
 */
export function resolveShareMonetaryAmountSync(shareRow, ctx) {
  if (!shareRow || !ctx) return 0
  const direct = parseFloat(shareRow.amount) || 0
  if (direct > 0.009) return Math.round(direct * 100) / 100

  const { bookingId, bookingTotal = 0, bookingDataParsed = {}, tournamentDataRaw, allShareRows = [] } = ctx

  const isTournament = bookingDataParsed.isTournament === true
  if (isTournament && tournamentDataRaw != null && tournamentDataRaw !== undefined) {
    const tt = String(bookingDataParsed.tournamentType || 'king').toLowerCase()
    const fb = feeFromClubTournamentDataForShare(tournamentDataRaw, bookingId, tt, shareRow)
    if (fb != null && fb > 0.009) return Math.round(fb * 100) / 100
  }

  const eff = effectiveShareAmountFromDbRows(bookingTotal, allShareRows, shareRow)
  return Math.round(Math.max(0, eff) * 100) / 100
}

/** Use when club_bookings row + share rows are already loaded (avoids duplicate booking query). */
export async function buildShareAmountResolveContext(clubId, bookingId, bookingRow, allShareRows) {
  const bookingTotal = parseFloat(bookingRow?.total_amount) || 0
  const bookingDataParsed = parseBookingJsonData(bookingRow?.data)
  let tournamentDataRaw = null
  if (bookingDataParsed.isTournament === true) {
    try {
      const cr = await query(`SELECT tournament_data FROM clubs WHERE id = ? AND (deleted_at IS NULL) LIMIT 1`, [clubId])
      tournamentDataRaw = cr?.rows?.[0]?.tournament_data
    } catch {
      tournamentDataRaw = null
    }
  }
  return {
    bookingId,
    bookingTotal,
    bookingDataParsed,
    tournamentDataRaw,
    allShareRows: Array.isArray(allShareRows) ? allShareRows : [],
  }
}

export async function loadShareAmountResolveContext(clubId, bookingId) {
  const { rows: bRows } = await query(
    `SELECT total_amount, data FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL`,
    [bookingId, clubId]
  )
  if (!bRows?.length) return null
  const sharesRes = await query(
    `SELECT id, amount, paid_at, refunded_at, removed_at, member_id, phone, invite_token FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?`,
    [bookingId, clubId]
  )
  return buildShareAmountResolveContext(clubId, bookingId, bRows[0], sharesRes?.rows || [])
}
