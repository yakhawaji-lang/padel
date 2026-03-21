/** Helpers for coach court grid - shared with ClubPublicPage logic */

export function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return 0
  const [h, m] = t.trim().split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function addMinutesToTime(timeStr, minutes) {
  const m = timeToMinutes(timeStr) + (minutes || 0)
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function isTimeSlotCoveredByBooking(timeSlot, startTime, endTime) {
  const slotM = timeToMinutes(timeSlot)
  const startM = timeToMinutes(startTime)
  const endM = timeToMinutes(endTime)
  if (endM <= startM && startTime) return slotM === startM
  return slotM >= startM && slotM < endM
}

export function isSlotInPast(dateStr, startTime) {
  if (!dateStr) return true
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (dateStr < todayStr) return true
  if (dateStr > todayStr) return false
  const [h, m] = (startTime || '00:00').toString().trim().split(':').map(Number)
  const slotMinutes = (h || 0) * 60 + (m || 0)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return slotMinutes <= nowMinutes
}

export function getTimeSlotsForClub(club) {
  const open = club?.settings?.openingTime
  const close = club?.settings?.closingTime
  const slots = []
  if (!open || !close) {
    for (let hour = 6; hour < 24; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`)
      slots.push(`${String(hour).padStart(2, '0')}:30`)
    }
    return slots
  }
  const [openH, openM] = open.split(':').map(Number)
  const [closeH, closeM] = close.split(':').map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM
  for (let m = openMinutes; m < closeMinutes; m += 30) {
    const h = Math.floor(m / 60) % 24
    const min = m % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return slots
}
