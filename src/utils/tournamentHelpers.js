/**
 * حالة البطولة من club.tournamentData (ملك الملعب / سوشيال) مفتاحها id الحجز
 */
export function getTournamentStateForBooking(club, booking) {
  if (!booking?.id || !club?.tournamentData) return null
  const bid = String(booking.id)
  const td = club.tournamentData
  const king = td.kingStateByTournamentId?.[bid]
  const social = td.socialStateByTournamentId?.[bid]
  return king || social || null
}

/** عدد الفرق المسجّلة في البطولة */
export function countTournamentTeams(club, booking) {
  const state = getTournamentStateForBooking(club, booking)
  return Array.isArray(state?.teams) ? state.teams.length : 0
}

/** إجمالي الأعضاء المعيّنين في فرق البطولة */
export function countTournamentMemberAssignments(club, booking) {
  const state = getTournamentStateForBooking(club, booking)
  const teams = state?.teams || []
  let n = 0
  teams.forEach((t) => {
    if (Array.isArray(t.memberIds)) n += t.memberIds.filter(Boolean).length
  })
  return n
}

/** هل لم يُعيَّن أي عضو بعد؟ (لا فرق أو لا أعضاء في الفرق) */
export function isTournamentWithoutMembers(club, booking) {
  return countTournamentMemberAssignments(club, booking) === 0
}

/**
 * تفاصيل الفرق لعرضها في صفحة النادي: عدد الفرق وعدد الأعضاء لكل فريق
 * @returns {{ teamCount: number, totalMembers: number, teams: Array<{ id: string, name: string, memberCount: number }> }}
 */
export function getTournamentTeamsDetail(club, booking) {
  const state = getTournamentStateForBooking(club, booking)
  const raw = Array.isArray(state?.teams) ? state.teams : []
  const teams = raw.map((t, idx) => {
    const memberIds = Array.isArray(t.memberIds) ? t.memberIds.filter(Boolean) : []
    const name = (t.name && String(t.name).trim()) || `Team ${idx + 1}`
    const id = t.id != null ? String(t.id) : `team-${idx}`
    return { id, name, memberCount: memberIds.length }
  })
  const totalMembers = teams.reduce((s, t) => s + t.memberCount, 0)
  return { teamCount: teams.length, totalMembers, teams }
}

/** هل العضو مشارك في البطولة (ضمن فريق أو participants) */
export function isMemberInTournamentBooking(club, booking, memberId) {
  if (!memberId || !booking?.isTournament) return false
  const mid = String(memberId)
  const parts = booking.participants
  if (Array.isArray(parts) && parts.some((p) => String(p?.memberId ?? p?.id ?? p) === mid)) return true
  const state = getTournamentStateForBooking(club, booking)
  const teams = state?.teams || []
  for (const t of teams) {
    const ids = t.memberIds || []
    if (ids.some((id) => String(id) === mid)) return true
  }
  return false
}

/** مفاتيح الملعب (معرّف / اسم) تتطابق مع قائمة حجز البطولة؟ (ملك الملعب أو سوشيال) */
export function kingTournamentReservesCourtIds(courtIdentifierKeys, booking) {
  if (!booking?.isTournament || !['king', 'social'].includes(booking.tournamentType)) return false
  if (['cancelled', 'expired'].includes((booking.status || '').toString())) return false
  const ids = booking.tournamentCourtIds
  if (!Array.isArray(ids) || ids.length === 0) return false
  const row = new Set((courtIdentifierKeys || []).filter(Boolean).map((x) => String(x).trim()))
  return ids.some((tid) => row.has(String(tid).trim()))
}

/** هل بطولة مجدولة (ملك / سوشيال) تحجز هذا الصف؟ */
export function kingTournamentReservesCourt(court, booking) {
  if (!court) return false
  return kingTournamentReservesCourtIds([court.id, court.name], booking)
}
