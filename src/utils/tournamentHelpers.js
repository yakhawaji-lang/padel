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

/** مفاتيح الملعب (معرّف / اسم) تتطابق مع قائمة حجز البطولة؟ */
export function kingTournamentReservesCourtIds(courtIdentifierKeys, booking) {
  if (!booking?.isTournament || booking.tournamentType !== 'king') return false
  if (['cancelled', 'expired'].includes((booking.status || '').toString())) return false
  const ids = booking.tournamentCourtIds
  if (!Array.isArray(ids) || ids.length === 0) return false
  const row = new Set((courtIdentifierKeys || []).filter(Boolean).map((x) => String(x).trim()))
  return ids.some((tid) => row.has(String(tid).trim()))
}

/** هل بطولة ملك الملعب تحجز هذا الصف (كائن ملعب من النادي)؟ */
export function kingTournamentReservesCourt(court, booking) {
  if (!court) return false
  return kingTournamentReservesCourtIds([court.id, court.name], booking)
}
