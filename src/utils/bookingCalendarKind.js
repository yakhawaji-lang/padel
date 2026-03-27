/** Court rental vs training vs tournament blocks on the bookings calendar */
export function getBookingCalendarKind(booking) {
  if (!booking) return 'court'
  if (booking.isTournament) {
    return (booking.tournamentType || '').toString().toLowerCase() === 'social' ? 'tournament_social' : 'tournament_king'
  }
  const d = booking.data && typeof booking.data === 'object' ? booking.data : {}
  if ((booking.type || d.type || '').toString().toLowerCase() === 'training') return 'training'
  return 'court'
}
