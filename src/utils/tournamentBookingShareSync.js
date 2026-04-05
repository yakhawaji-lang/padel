/**
 * Keep tournament team rosters in sync with booking_payment_shares (split / guest invites).
 * Source of truth for "who was invited / registered": payment shares on the booking.
 */

import { effectiveShareAmount } from './paymentShareEffectiveAmounts.js'

function phoneDigits(raw) {
  return String(raw || '').replace(/\D/g, '')
}

function shareIsActive(s) {
  return !(s.removedAt || s.removed_at)
}

function bookingPaymentShares(booking) {
  return Array.isArray(booking?.paymentShares) ? booking.paymentShares : []
}

function normalizeTeamsFromPrev(prevState, defaultTeamCount, language) {
  const prev = prevState && typeof prevState === 'object' ? prevState : {}
  let teams = Array.isArray(prev.teams)
    ? prev.teams.map((t) => ({
        ...t,
        memberIds: [...(t.memberIds || [])],
        memberTournamentPayments: { ...(t.memberTournamentPayments || {}) },
        pendingFeeGuests: [...(t.pendingFeeGuests || [])],
      }))
    : []

  if (teams.length === 0) {
    const ar = language === 'ar'
    teams = Array.from({ length: defaultTeamCount }, (_, i) => ({
      id: i + 1,
      name: ar ? `فريق ${i + 1}` : `Team ${i + 1}`,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesWon: 0,
      gamesLost: 0,
      matchesPlayed: 0,
      memberIds: [],
      memberTournamentPayments: {},
      pendingFeeGuests: [],
    }))
  }
  return { prev, teams }
}

function teamLoadScore(t) {
  return (t.memberIds || []).length + (t.pendingFeeGuests || []).length
}

function pickTeamIndex(teams) {
  let best = 0
  let bestScore = Infinity
  teams.forEach((t, i) => {
    const n = teamLoadScore(t)
    if (n < bestScore) {
      bestScore = n
      best = i
    }
  })
  return best
}

function teamHasMemberId(teams, mstr) {
  return teams.some((t) => (t.memberIds || []).some((id) => String(id) === mstr))
}

function emptyPaymentEntry() {
  return { fee: '', clubReceived: false, memberAck: false }
}

function teamsPayloadSignature(teams) {
  const norm = (teams || []).map((t) => ({
    id: t.id,
    memberIds: [...(t.memberIds || [])].map(String).sort(),
    pending: [...(t.pendingFeeGuests || [])]
      .map((g) => ({
        id: g.id,
        ph: phoneDigits(g.phoneDisplay),
        fee: String(g.fee || ''),
        tok: g.inviteToken || '',
      }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    mp: Object.keys(t.memberTournamentPayments || {})
      .sort()
      .reduce((o, k) => {
        const e = (t.memberTournamentPayments || {})[k]
        o[k] = e && typeof e === 'object' ? { fee: String(e.fee || ''), c: !!e.clubReceived, m: !!e.memberAck } : {}
        return o
      }, {}),
  }))
  return JSON.stringify(norm)
}

/**
 * @param {object} booking — club booking row (isTournament, tournamentType, paymentShares, …)
 * @param {object|null} prevState — king or social state for this booking id
 * @param {{ language?: string, defaultTeamCount?: number }} options
 * @returns {object|null} — patch { teams, memberTournamentPayments fixes } merged into full state, or null if unchanged
 */
export function mergeTournamentTeamsFromPaymentShares(booking, prevState, options = {}) {
  if (!booking?.isTournament) return null
  const tt = String(booking.tournamentType || 'king').toLowerCase()
  if (tt !== 'king' && tt !== 'social') return null

  const language = options.language || 'en'
  const defaultTeamCount = options.defaultTeamCount ?? 8

  const shares = bookingPaymentShares(booking)
  if (shares.length === 0) return null

  const activeShares = shares.filter(shareIsActive)

  const bookerId = String(
    booking.initiatorMemberId || booking.memberId || booking.initiator_member_id || booking.member_id || ''
  ).trim()

  const participantAllow = new Set()
  if (Array.isArray(booking.participants)) {
    for (const p of booking.participants) {
      const id = p?.memberId ?? p?.id
      if (id) participantAllow.add(String(id))
    }
  }
  if (bookerId) participantAllow.add(bookerId)

  const shareMemberIds = new Set()
  for (const s of activeShares) {
    const mid = s.memberId ?? s.member_id
    if (mid) shareMemberIds.add(String(mid))
  }

  const allowedOnTeams = new Set([...participantAllow, ...shareMemberIds])

  const { prev, teams: teamsIn } = normalizeTeamsFromPrev(prevState, defaultTeamCount, language)
  let teams = teamsIn

  const sigBefore = teamsPayloadSignature(teams)

  // 1) Prune members not allowed (booking participants + active share members + booker)
  teams = teams.map((team) => {
    const ids = (team.memberIds || []).filter((mid) => allowedOnTeams.has(String(mid)))
    const mpIn = { ...(team.memberTournamentPayments || {}) }
    const mp = {}
    for (const id of ids) {
      mp[id] = mpIn[id] && typeof mpIn[id] === 'object' ? { ...emptyPaymentEntry(), ...mpIn[id] } : emptyPaymentEntry()
    }
    return { ...team, memberIds: ids, memberTournamentPayments: mp }
  })

  // 2) Guest phones that should appear as pending chips (unpaid split row without member id yet)
  const guestPhoneKeys = new Set()
  for (const s of activeShares) {
    if (s.memberId ?? s.member_id) continue
    const ph = s.phone
    const dig = phoneDigits(ph)
    if (dig.length >= 8) guestPhoneKeys.add(dig)
  }

  teams = teams.map((team) => ({
    ...team,
    pendingFeeGuests: (team.pendingFeeGuests || []).filter((g) => guestPhoneKeys.has(phoneDigits(g.phoneDisplay))),
  }))

  // 3) Upsert pending guests from shares
  for (const s of activeShares) {
    if (s.memberId ?? s.member_id) continue
    const ph = s.phone
    const dig = phoneDigits(ph)
    if (dig.length < 8) continue

    const token = (s.inviteToken || s.invite_token || '').toString()
    const gid = s.id != null ? `share-${s.id}` : token ? `tok-${token}` : `ph-${dig}`
    const feeNum = effectiveShareAmount(booking, s)
    const fee = String(feeNum)
    const display = String(ph).trim()

    let foundTeamIdx = -1
    let foundGuestIdx = -1
    teams.forEach((t, ti) => {
      ;(t.pendingFeeGuests || []).forEach((g, gi) => {
        if (g.id === gid || phoneDigits(g.phoneDisplay) === dig) {
          foundTeamIdx = ti
          foundGuestIdx = gi
        }
      })
    })

    if (foundTeamIdx >= 0) {
      const t = teams[foundTeamIdx]
      const pg = [...(t.pendingFeeGuests || [])]
      if (foundGuestIdx >= 0) {
        pg[foundGuestIdx] = {
          ...pg[foundGuestIdx],
          phoneDisplay: display,
          fee,
          inviteToken: token || pg[foundGuestIdx].inviteToken || null,
        }
      }
      teams[foundTeamIdx] = { ...t, pendingFeeGuests: pg }
    } else {
      const ti = pickTeamIndex(teams)
      const t = teams[ti]
      const pg = [...(t.pendingFeeGuests || [])].filter((g) => phoneDigits(g.phoneDisplay) !== dig)
      pg.push({
        id: gid,
        phoneDisplay: display,
        fee,
        inviteToken: token || null,
      })
      teams[ti] = { ...t, pendingFeeGuests: pg }
    }
  }

  // 4) Add registered share members to teams (balance load)
  for (const s of activeShares) {
    const mid = s.memberId ?? s.member_id
    if (!mid) continue
    const mstr = String(mid)
    if (teamHasMemberId(teams, mstr)) continue

    const ti = pickTeamIndex(teams)
    const t = teams[ti]
    const ids = [...(t.memberIds || [])]
    if (ids.some((x) => String(x) === mstr)) continue
    ids.push(mstr)
    const mp = { ...(t.memberTournamentPayments || {}) }
    const prevEntry = mp[mstr] && typeof mp[mstr] === 'object' ? mp[mstr] : {}
    const feeNum = effectiveShareAmount(booking, s)
    const feeStr =
      prevEntry.fee != null && String(prevEntry.fee).trim() !== ''
        ? String(prevEntry.fee)
        : String(feeNum)
    mp[mstr] = { ...emptyPaymentEntry(), ...prevEntry, fee: feeStr }
    teams[ti] = { ...t, memberIds: ids, memberTournamentPayments: mp }
  }

  if (teamsPayloadSignature(teams) === sigBefore) return null

  return {
    ...prev,
    teams,
  }
}

export function tournamentTeamSyncChanged(prevState, merged) {
  if (!merged) return false
  return teamsPayloadSignature(prevState?.teams) !== teamsPayloadSignature(merged.teams)
}
