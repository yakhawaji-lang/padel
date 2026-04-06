/**
 * Effective amounts for split-payment shares when DB `amount` is 0:
 * distribute (booking total − sum of positive share amounts) across active zero-amount shares.
 */

function phoneDigits(raw) {
  return String(raw || '').replace(/\D/g, '')
}

/** Parsed numeric amount stored on the share row (camelCase or snake_case). */
export function shareAmountRaw(share) {
  if (!share) return 0
  const v = parseFloat(share.amount ?? share.share_amount)
  return Number.isFinite(v) ? v : 0
}

function bookingIsTournamentSplit(booking) {
  if (!booking) return false
  if (booking.isTournament === true) return true
  const d = booking.data
  if (d && typeof d === 'object' && d.isTournament === true) return true
  if (booking.tournamentType != null || booking.tournament_type != null) return true
  if (d && typeof d === 'object' && (d.tournamentType != null || d.tournament_type != null)) return true
  return false
}

/**
 * Fee entered in King/Social UI (pending guests / member tournament payments) when DB share.amount is 0
 * but the booking total was fully "allocated" on another row — admin list still shows the intended share.
 * @param {object} tournamentData — club.tournamentData (kingStateByTournamentId / socialStateByTournamentId)
 */
export function feeFromTournamentClubState(booking, share, tournamentData) {
  if (!tournamentData || !share || !booking) return null
  if (!bookingIsTournamentSplit(booking)) return null
  const bid = String(booking.id ?? '').trim()
  if (!bid) return null

  const tt = String(
    booking.tournamentType ||
      booking.tournament_type ||
      booking.data?.tournamentType ||
      booking.data?.tournament_type ||
      'king'
  ).toLowerCase()
  const useSocial = tt === 'social'
  const stateMap = useSocial
    ? tournamentData.socialStateByTournamentId || {}
    : tournamentData.kingStateByTournamentId || {}
  if (!stateMap || typeof stateMap !== 'object') return null

  const state = stateMap[bid] ?? stateMap[booking.id]
  if (!state?.teams || !Array.isArray(state.teams)) return null

  const sharePhone = phoneDigits(share.phone)
  const shareTok = String(share.inviteToken || share.invite_token || '').trim()
  const shareMem = String(share.memberId || share.member_id || '').trim()

  for (const team of state.teams) {
    for (const g of team.pendingFeeGuests || []) {
      const gTok = g.inviteToken != null ? String(g.inviteToken).trim() : ''
      if (shareTok && gTok && shareTok === gTok) {
        const f = parseFloat(g.fee)
        if (Number.isFinite(f) && f > 0.009) return f
      }
      const gd = phoneDigits(g.phoneDisplay)
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

export function shareRowIsRemoved(s) {
  return !!(s?.removedAt || s?.removed_at)
}

export function shareRowIsActive(s) {
  return !shareRowIsRemoved(s)
}

export function bookingTotalForShares(booking) {
  if (!booking) return 0
  const db = parseFloat(booking.totalAmount ?? booking.total_amount)
  if (Number.isFinite(db) && db > 0.009) return Math.round(db * 100) / 100
  const p = parseFloat(booking.price)
  if (Number.isFinite(p) && p > 0.009) return Math.round(p * 100) / 100
  const a = parseFloat(booking.amount)
  if (Number.isFinite(a) && a > 0.009) return Math.round(a * 100) / 100
  return 0
}

/**
 * @param {object} booking
 * @param {object} share — one row from booking.paymentShares
 * @param {{ tournamentData?: object }} [options] — pass club.tournamentData for tournament fee fallback when DB/split math yields 0
 * @returns {number}
 */
export function effectiveShareAmount(booking, share, options = {}) {
  if (!share) return 0
  if (shareRowIsRemoved(share)) return Math.round(shareAmountRaw(share) * 100) / 100

  const direct = shareAmountRaw(share)
  if (direct > 0.009) return Math.round(direct * 100) / 100

  const allShares = Array.isArray(booking?.paymentShares) ? booking.paymentShares : []
  const active = allShares.filter(shareRowIsActive)
  const zeros = active.filter((s) => shareAmountRaw(s) <= 0.009)
  if (zeros.length === 0) {
    const fbZero = feeFromTournamentClubState(booking, share, options.tournamentData)
    return fbZero != null && fbZero > 0.009 ? Math.round(fbZero * 100) / 100 : 0
  }

  const total = bookingTotalForShares(booking)
  if (total <= 0.009) {
    const fbTot = feeFromTournamentClubState(booking, share, options.tournamentData)
    return fbTot != null && fbTot > 0.009 ? Math.round(fbTot * 100) / 100 : 0
  }

  const allocated = active.reduce((sum, s) => {
    const v = shareAmountRaw(s)
    return sum + (v > 0.009 ? v : 0)
  }, 0)

  const remainder = Math.max(0, Math.round((total - allocated) * 100) / 100)
  if (remainder <= 0.009) {
    const fbRem = feeFromTournamentClubState(booking, share, options.tournamentData)
    return fbRem != null && fbRem > 0.009 ? Math.round(fbRem * 100) / 100 : 0
  }

  const each = Math.round((remainder / zeros.length) * 100) / 100
  if (each > 0.009) return each

  const fbLast = feeFromTournamentClubState(booking, share, options.tournamentData)
  return fbLast != null && fbLast > 0.009 ? Math.round(fbLast * 100) / 100 : each
}

/** Match a tournament pending guest chip to a payment share row */
export function findPaymentShareForPendingGuest(booking, guestChip) {
  const shares = Array.isArray(booking?.paymentShares) ? booking.paymentShares : []
  const gd = phoneDigits(guestChip?.phoneDisplay || '')
  const tok = guestChip?.inviteToken != null ? String(guestChip.inviteToken).trim() : ''
  const fromId = String(guestChip?.id || '').startsWith('share-')
    ? String(guestChip.id).replace(/^share-/, '')
    : ''

  return (
    shares.find((s) => {
      if (shareRowIsRemoved(s)) return false
      if (fromId && String(s.id) === fromId) return true
      const st = (s.inviteToken || s.invite_token || '').toString().trim()
      if (tok && st && st === tok) return true
      const sd = phoneDigits(s.phone)
      if (gd.length >= 8 && sd === gd) return true
      return false
    }) || null
  )
}

export function effectivePendingGuestFee(booking, guestChip, options = {}) {
  if (!guestChip) return 0
  const sh = booking ? findPaymentShareForPendingGuest(booking, guestChip) : null
  if (sh && booking) return effectiveShareAmount(booking, sh, options)
  return Math.round((parseFloat(guestChip.fee) || 0) * 100) / 100
}
