/**
 * Court booking pricing - calculate price from club settings
 * Supports: duration, time-of-day, day-of-week, seasons
 */

/** Convert HH:mm to minutes from midnight */
const timeToMinutes = (t) => {
  if (!t || typeof t !== 'string') return 0
  const [h, m] = t.trim().split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Get day of week (0=Sun, 6=Sat) from date string YYYY-MM-DD */
const getDayOfWeek = (dateStr) => {
  if (!dateStr) return 0
  const d = new Date(dateStr + 'T12:00:00')
  return d.getDay()
}

/** Check if date falls in season. start/end: YYYY-MM-DD or MM-DD */
const isInSeason = (dateStr, startStr, endStr) => {
  if (!dateStr || !startStr || !endStr) return false
  const [y, m, day] = dateStr.split('-').map(Number)
  const dateVal = (m || 0) * 100 + (day || 0)
  const norm = (s) => {
    const p = (s || '').split('-')
    if (p.length >= 3) return (parseInt(p[1], 10) || 0) * 100 + (parseInt(p[2], 10) || 0)
    if (p.length >= 2) return (parseInt(p[0], 10) || 0) * 100 + (parseInt(p[1], 10) || 0)
    return 0
  }
  const startVal = norm(startStr)
  const endVal = norm(endStr)
  if (startVal <= endVal) return dateVal >= startVal && dateVal <= endVal
  return dateVal >= startVal || dateVal <= endVal
}

/**
 * Calculate booking price for given parameters
 * @param {Object} club - Club object with settings.bookingPrices
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} startTime - HH:mm
 * @param {number} durationMinutes - e.g. 60, 90
 * @returns {{ price: number, breakdown: string[] }}
 */
export function calculateBookingPrice(club, dateStr, startTime, durationMinutes) {
  const bp = club?.settings?.bookingPrices || {}
  const currency = club?.settings?.currency || 'SAR'
  const breakdown = []

  // 1. السعر من الإعدادات فقط — تطابق تام للمدة، لا حسابات تلقائية
  const durationPrices = bp.durationPrices || []
  const exact = durationPrices.find(d => (d.durationMinutes || 0) === durationMinutes)
  let basePrice = 0
  if (exact != null && exact.price != null) {
    basePrice = Math.round(parseFloat(exact.price)) || 0
    breakdown.push(`${durationMinutes} min → ${basePrice} ${currency}`)
  }

  // لا تطبيق معدّلات (أيام/وقت/موسم) — السعر من إعدادات المدة فقط
  return { price: basePrice, currency, breakdown }
}

/** Get default booking prices structure */
export function getDefaultBookingPrices() {
  return {
    durationPrices: [
      { durationMinutes: 60, price: 100 },
      { durationMinutes: 90, price: 140 },
      { durationMinutes: 120, price: 180 }
    ],
    dayModifiers: [
      { days: [0, 1, 2, 3, 4], labelKey: 'weekdays', multiplier: 1 },
      { days: [5, 6], labelKey: 'weekend', multiplier: 1.2 }
    ],
    timeModifiers: [
      { start: '06:00', end: '12:00', labelKey: 'morning', multiplier: 0.9 },
      { start: '12:00', end: '18:00', labelKey: 'afternoon', multiplier: 1 },
      { start: '18:00', end: '23:00', labelKey: 'evening', multiplier: 1.2 }
    ],
    seasonModifiers: [
      { startDate: '2025-06-01', endDate: '2025-08-31', labelKey: 'summer', multiplier: 1.2 },
      { startDate: '2025-09-01', endDate: '2026-05-31', labelKey: 'regular', multiplier: 1 }
    ]
  }
}
