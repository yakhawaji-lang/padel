/**
 * Seasonal / multi-window club working hours.
 * Seasons use MM–DD ranges (calendar year–agnostic). Last matching season wins (list default first, then overrides).
 */

export function timeToMinutes(t) {
  if (!t || typeof t !== 'string') return 0
  const [h, m] = t.trim().split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesToHHMM(m) {
  const mm = Math.round(m)
  const h = Math.floor(mm / 60) % 24
  const min = ((mm % 60) + 60) % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function isoDateToMonthDay(isoDate) {
  const parts = (isoDate || '').split('-')
  if (parts.length < 3) return null
  return `${parts[1]}-${parts[2]}`
}

/** MM-DD in [startMM, endMM] inclusive; supports wrap (e.g. 11-01 .. 03-15). */
export function monthDayInRange(mmdd, startMM, endMM) {
  if (!mmdd || !startMM || !endMM) return true
  if (startMM <= endMM) return mmdd >= startMM && mmdd <= endMM
  return mmdd >= startMM || mmdd <= endMM
}

function normalizePeriod(p) {
  const open = (p?.open || p?.start || '').toString().trim()
  const close = (p?.close || p?.end || '').toString().trim()
  const o = timeToMinutes(open)
  const c = timeToMinutes(close)
  if (!open || !close || o >= c) return null
  return { open: minutesToHHMM(o), close: minutesToHHMM(c) }
}

function legacyPeriodsFromSettings(settings) {
  const open = (settings?.openingTime || '06:00').toString().trim()
  const close = (settings?.closingTime || '23:00').toString().trim()
  const o = timeToMinutes(open)
  const c = timeToMinutes(close)
  if (o < c) return [{ open, close }]
  return []
}

export function normalizeWorkingHoursSeasons(settings) {
  const raw = settings?.workingHoursSeasons
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((s, i) => {
      const startDate = (s.startDate || '01-01').toString().trim().slice(0, 5)
      const endDate = (s.endDate || '12-31').toString().trim().slice(0, 5)
      const periodsIn = Array.isArray(s.periods) ? s.periods : []
      const periods = periodsIn.map(normalizePeriod).filter(Boolean)
      return {
        id: s.id || `season-${i}`,
        label: (s.label || '').toString(),
        startDate,
        endDate,
        periods
      }
    })
  }
  return [{
    id: 'default',
    label: '',
    startDate: '01-01',
    endDate: '12-31',
    periods: legacyPeriodsFromSettings(settings)
  }]
}

/** Last matching season in array order wins. */
export function getSeasonForDate(settings, isoDate) {
  const mmdd = isoDateToMonthDay(isoDate)
  if (!mmdd) return null
  const seasons = normalizeWorkingHoursSeasons(settings)
  let match = null
  for (const s of seasons) {
    if (monthDayInRange(mmdd, s.startDate, s.endDate)) match = s
  }
  return match || seasons[0] || null
}

export function getDayPeriodsForDate(settings, isoDate) {
  const s = getSeasonForDate(settings, isoDate)
  if (!s?.periods?.length) return []
  return s.periods
    .map(p => ({ startM: timeToMinutes(p.open), endM: timeToMinutes(p.close) }))
    .filter(r => r.endM > r.startM)
}

export function mergeMinuteRanges(ranges) {
  const arr = [...ranges].filter(r => r.endM > r.startM).sort((a, b) => a.startM - b.startM)
  if (arr.length === 0) return []
  const out = []
  let cur = { ...arr[0] }
  for (let i = 1; i < arr.length; i++) {
    const r = arr[i]
    if (r.startM <= cur.endM) cur.endM = Math.max(cur.endM, r.endM)
    else {
      out.push(cur)
      cur = { ...r }
    }
  }
  out.push(cur)
  return out
}

export function getMergedWindowsForDate(settings, isoDate) {
  const merged = mergeMinuteRanges(getDayPeriodsForDate(settings, isoDate))
  if (merged.length > 0) return merged
  const o = timeToMinutes(settings?.openingTime || '06:00')
  const c = timeToMinutes(settings?.closingTime || '23:00')
  if (o < c) return [{ startM: o, endM: c }]
  return []
}

export function intervalCoveredByUnion(windows, a, b) {
  if (b <= a) return true
  let x = a
  for (const w of windows) {
    if (x >= b) return true
    if (w.endM <= x) continue
    if (w.startM > x) return false
    x = Math.max(x, w.endM)
  }
  return x >= b
}

export function coversBookingInterval(mergedToday, mergedNext, startM, endAbsMinutes) {
  const next = mergedNext || []
  if (endAbsMinutes <= 1440) {
    return intervalCoveredByUnion(mergedToday, startM, endAbsMinutes)
  }
  const part2 = endAbsMinutes - 1440
  if (!intervalCoveredByUnion(mergedToday, startM, 1440)) return false
  return intervalCoveredByUnion(next, 0, part2)
}

export function getPublicBookingTimeSlots(settings, isoDate, stepMinutes = 30) {
  const step = Math.max(1, Number(stepMinutes) || 30)
  const merged = getMergedWindowsForDate(settings, isoDate)
  const slots = []
  for (const w of merged) {
    for (let m = w.startM; m + step <= w.endM; m += step) {
      slots.push(minutesToHHMM(m))
    }
  }
  return slots
}

export function getUnionTimeSlotsForDates(settings, isoDates, stepMinutes = 30) {
  const set = new Set()
  for (const d of isoDates || []) {
    getPublicBookingTimeSlots(settings, d, stepMinutes).forEach(t => set.add(t))
  }
  return Array.from(set).sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
}

/** Min–max envelope across all seasons (legacy min/max time inputs). */
export function getLegacyOpenCloseBounds(settings) {
  const seasons = normalizeWorkingHoursSeasons(settings)
  let minO = 24 * 60
  let maxC = 0
  for (const s of seasons) {
    for (const p of s.periods || []) {
      const o = timeToMinutes(p.open)
      const c = timeToMinutes(p.close)
      if (o < c) {
        minO = Math.min(minO, o)
        maxC = Math.max(maxC, c)
      }
    }
  }
  if (minO >= maxC) {
    return {
      openingTime: (settings?.openingTime || '06:00').toString(),
      closingTime: (settings?.closingTime || '23:00').toString()
    }
  }
  return { openingTime: minutesToHHMM(minO), closingTime: minutesToHHMM(maxC) }
}

export function isSameDayIntervalWithinClubHours(settings, dateStr, startTime, endTime) {
  const merged = getMergedWindowsForDate(settings, dateStr)
  if (merged.length === 0) return true
  const s = timeToMinutes(startTime)
  const e = timeToMinutes(endTime)
  if (e <= s) return false
  return intervalCoveredByUnion(merged, s, e)
}
