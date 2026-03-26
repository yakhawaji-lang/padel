/**
 * سياسات رسوم تعديل/إلغاء الحجز
 */
export function computePolicyFee(mode, value, baseAmount) {
  const m = (mode || 'none').toString().toLowerCase()
  const base = Math.max(0, parseFloat(baseAmount) || 0)
  const v = parseFloat(value) || 0
  if (m === 'none' || !m) return 0
  if (m === 'percent') return Math.round(base * Math.min(100, Math.max(0, v)) / 100 * 100) / 100
  if (m === 'fixed') return Math.round(Math.max(0, v) * 100) / 100
  return 0
}

export function hoursUntilBookingStart(bookingDateYmd, startTimeHHMM) {
  if (!bookingDateYmd || !startTimeHHMM) return null
  const [H, M] = String(startTimeHHMM).split(':').map((x) => parseInt(x, 10) || 0)
  const [y, mo, d] = String(bookingDateYmd).split('-').map((x) => parseInt(x, 10))
  if (!y || !mo || !d) return null
  const start = new Date(y, mo - 1, d, H, M, 0, 0)
  const ms = start.getTime() - Date.now()
  return ms / (3600 * 1000)
}
