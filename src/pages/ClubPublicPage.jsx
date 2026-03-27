import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { loadClubs, getClubById, getClubMembersFromStorage, getAllMembersFromStorage, addMemberToClub, addBookingToClub, refreshClubsFromApi, upsertMember } from '../storage/adminStorage'
import { calculateBookingPrice } from '../utils/bookingPricing'
import * as bookingApi from '../api/dbClient'
import { getStore } from '../api/dbClient'
import { getImageUrl, sendWelcomeClubJoinEmail } from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import CalendarPicker from '../components/CalendarPicker'
import SocialIcon from '../components/SocialIcon'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getClubAdminSession } from '../storage/clubAuth'
import MemberAccountDropdown from '../components/MemberAccountDropdown'
import BookingCountdownCard from '../components/BookingCountdownCard'
import BookingPaymentShare from '../components/BookingPaymentShare'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import { isTournamentWithoutMembers, kingTournamentReservesCourt, kingTournamentReservesCourtIds, getTournamentTeamsDetail } from '../utils/tournamentHelpers'
import { getMergedWindowsForDate, getPublicBookingTimeSlots, coversBookingInterval } from '../utils/clubWorkingHours'
import { getEffectivePaymentChannels, pickFirstPaymentMethod } from '../utils/paymentChannels'
import './ClubPublicPage.css'
import { memberRelatesToCourtBooking } from '../utils/paymentShareMemberMatch.js'
import { isMemberCancelledBooking } from '../utils/bookingMemberCancel'
import '../components/BookingPaymentShare.css'

const getClubBookings = (clubId) => {
  try {
    const club = getClubById(clubId)
    return club?.bookings && Array.isArray(club.bookings) ? club.bookings : []
  } catch (e) {
    return []
  }
}

/** تحويل وقت "HH:mm" إلى دقائق من منتصف الليل */
const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0
  const [h, m] = timeStr.trim().split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** هل الفترة الزمنية (timeSlot) تقع داخل نطاق الحجز [startTime, endTime)؟ */
const isTimeSlotCoveredByBooking = (timeSlot, startTime, endTime) => {
  const slotM = timeToMinutes(timeSlot)
  const startM = timeToMinutes(startTime)
  const endM = timeToMinutes(endTime)
  return slotM >= startM && slotM < endM
}

/** إضافة دقائق إلى وقت "HH:mm" وإرجاع "HH:mm" (بعد منتصف الليل يسجَّل كوقت اليوم التالي، مثل 01:00) */
const addMinutesToTime = (timeStr, minutes) => {
  const m = timeToMinutes(timeStr) + (minutes || 0)
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

const shiftCalendarDateStr = (isoDateStr, deltaDays) => {
  const [y, mo, d] = (isoDateStr || '').split('-').map(Number)
  if (!y || !mo || !d) return null
  const dt = new Date(y, mo - 1, d + deltaDays)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** هل الشريحة (التاريخ + وقت البداية) في الماضي أو الآن؟ لا نسمح بالحجز في الماضي */
const isSlotInPast = (dateStr, startTime) => {
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

/** هل النطاق [ourStart, ourEnd) يتداخل مع أي نطاق في القائمة؟ (تداخل = other.start < ourEnd && other.end > ourStart) */
const overlapsAny = (ourStartM, ourEndM, ranges) => {
  return ranges.some(({ startM, endM }) => ourStartM < endM && ourEndM > startM)
}

/** استخراج نطاقات محجوزة أو مقفلة لملعب وتاريخ معين (بالدقائق من منتصف الليل) — preparationTimeMinutes معطّل (0) */
const getBlockedRangesForCourtAndDate = (courtNameOrId, dateStr, bookings, activeLocks, excludeLockId = null, preparationTimeMinutes = 0) => {
  const courtIds = []
  if (courtNameOrId && typeof courtNameOrId === 'object') {
    const id = (courtNameOrId.id || '').toString().trim()
    const name = (courtNameOrId.name || '').toString().trim()
    if (id) courtIds.push(id)
    if (name && !courtIds.includes(name)) courtIds.push(name)
  }
  if (courtIds.length === 0) courtIds.push((courtNameOrId || '').toString().trim())
  const matchCourt = (res) => courtIds.some(c => c && res === c)
  const prep = Math.max(0, Number(preparationTimeMinutes) || 0)
  const ranges = []
  const appendRange = (startM, endM) => {
    let eM = endM
    if (eM > startM) ranges.push({ startM, endM: eM })
  }
  const addOvernightPairToDate = (segmentDate, start, end, addPrepSegment) => {
    const startM = timeToMinutes(start)
    let endM = timeToMinutes(end)
    if (addPrepSegment && prep > 0) endM += prep
    if (endM > startM) {
      if (segmentDate === dateStr) appendRange(startM, endM)
      return
    }
    if (endM < startM) {
      if (segmentDate === dateStr) appendRange(startM, 1440)
      const nextD = shiftCalendarDateStr(segmentDate, 1)
      if (nextD === dateStr) appendRange(0, endM)
    }
  }
  ;(bookings || []).forEach(b => {
    if (b.isTournament) {
      if (!['king', 'social'].includes(b.tournamentType) || !kingTournamentReservesCourtIds(courtIds, b)) return
      if (['cancelled', 'expired'].includes((b.status || '').toString().toLowerCase())) return
      const bDate = (b.date || b.startDate || '').toString().split('T')[0]
      if (bDate !== dateStr) {
        const prev = shiftCalendarDateStr(dateStr, -1)
        if (bDate !== prev) return
      }
      const start = (b.startTime || b.timeSlot || '').toString().trim()
      let end = (b.endTime || '').toString().trim()
      if (!end && start) end = addMinutesToTime(start, 60)
      const bDateNorm = (b.date || b.startDate || '').toString().split('T')[0]
      addOvernightPairToDate(bDateNorm, start, end, true)
      return
    }
    if (['cancelled', 'expired'].includes((b.status || '').toString().toLowerCase())) return
    const bDate = (b.date || b.startDate || '').toString().split('T')[0]
    if (bDate !== dateStr) {
      const prev = shiftCalendarDateStr(dateStr, -1)
      if (bDate !== prev) return
    }
    const res = (b.resource || b.court || b.courtId || '').toString().trim()
    if (!matchCourt(res)) return
    const start = (b.startTime || b.timeSlot || '').toString().trim()
    let end = (b.endTime || '').toString().trim()
    if (!end && start) end = addMinutesToTime(start, 60)
    const bDateNorm = (b.date || b.startDate || '').toString().split('T')[0]
    addOvernightPairToDate(bDateNorm, start, end, true)
  })
  ;(activeLocks || []).forEach(l => {
    if (excludeLockId && (l.id === excludeLockId || (l.lock_id || l.lockId) === excludeLockId)) return
    const lCourt = (l.court_id || '').toString().trim()
    if (!matchCourt(lCourt)) return
    const lDate = (l.booking_date || '').toString().split('T')[0]
    if (lDate !== dateStr) {
      const prev = shiftCalendarDateStr(dateStr, -1)
      if (lDate !== prev) return
    }
    addOvernightPairToDate(lDate, l.start_time || '', l.end_time || '', false)
  })
  return ranges
}

/** مدد متاحة: ضمن اتحاد نوافذ يوم العمل (ومنتصف الليل عند اليوم التالي)، دون تعارض مع الحجوزات */
const getAvailableDurations = (minDur, startTime, mergedToday, mergedNext, blockedToday, blockedNext, maxDurationCap = 180) => {
  const startM = timeToMinutes(startTime)
  const nextBlocked = blockedNext || []
  const out = []
  for (let d = minDur; d <= maxDurationCap; d += 30) {
    const endAbs = startM + d
    if (!coversBookingInterval(mergedToday, mergedNext, startM, endAbs)) continue
    if (endAbs <= 1440) {
      if (!overlapsAny(startM, endAbs, blockedToday)) out.push(d)
    } else {
      const part2End = endAbs - 1440
      if (overlapsAny(startM, 1440, blockedToday)) continue
      if (overlapsAny(0, part2End, nextBlocked)) continue
      out.push(d)
    }
  }
  return out
}

/** خطوة عرض الشبكة على صفحة الحجز العامة — دائماً 30 دقيقة (كل نصف ساعة عمود مستقل) */
const PUBLIC_SLOT_STEP_MINUTES = 30
/** المدد المعروضة بعد اختيار الشق: 60 / 90 / 120 فقط إن وُجدت في Price per duration */
const PUBLIC_PRICE_DURATION_ORDER = [60, 90, 120]

const getDurationPricesFromClub = (club) => {
  const raw = Array.isArray(club?.settings?.bookingPrices?.durationPrices) ? club.settings.bookingPrices.durationPrices : []
  return raw
    .map(d => ({ durationMinutes: Number(d.durationMinutes) || 0, price: parseFloat(d.price) }))
    .filter(d => d.durationMinutes > 0 && !Number.isNaN(d.price))
}

const getPublicPricedDurationOptions = (club) => {
  const list = getDurationPricesFromClub(club)
  const byDur = new Map(list.map(d => [d.durationMinutes, d]))
  return PUBLIC_PRICE_DURATION_ORDER.filter(m => byDur.has(m)).map(m => ({ durationMinutes: m, price: byDur.get(m).price }))
}

const getMinPricedDurationMinutes = (club) => {
  const opts = getPublicPricedDurationOptions(club)
  if (opts.length > 0) return Math.min(...opts.map(o => o.durationMinutes))
  return 60
}

const getMaxPricedDurationMinutes = (club) => {
  const opts = getPublicPricedDurationOptions(club)
  if (opts.length > 0) return Math.max(...opts.map(o => o.durationMinutes))
  return 120
}

/** لون مميّز لكل بطولة (HSL) من المعرف */
const tournamentAccentHue = (tournamentId) => {
  const s = String(tournamentId ?? 't')
  let h = 7
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0
  return h % 360
}

const getTimeSlotsForClub = (club, dateStr) =>
  getPublicBookingTimeSlots(club?.settings, dateStr, PUBLIC_SLOT_STEP_MINUTES)

const isSlotAValidBookableStart = (club, dateStr, timeSlot) => {
  const slots = getPublicBookingTimeSlots(club?.settings, dateStr, PUBLIC_SLOT_STEP_MINUTES)
  return slots.includes(timeSlot)
}

const getClubTournamentStats = (club) => {
  const data = club?.tournamentData || {}
  const king = data.kingStateByTournamentId || {}
  const social = data.socialStateByTournamentId || {}
  let tournamentsCount = 0
  let matchesCount = 0
  Object.values(king).forEach(s => {
    if (s && (s.teams?.length || s.matches?.length)) {
      tournamentsCount++
      matchesCount += s.matches?.length || 0
    }
  })
  Object.values(social).forEach(s => {
    if (s && (s.teams?.length || s.matches?.length)) {
      tournamentsCount++
      matchesCount += s.matches?.length || 0
    }
  })
  return { tournamentsCount, matchesCount }
}

const ClubPublicPage = () => {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const [club, setClub] = useState(null)
  const [language, setLanguage] = useState(() => {
    const appLang = getAppLanguage()
    if (appLang) return appLang
    const c = getClubById(clubId)
    return c?.settings?.defaultLanguage || 'en'
  })
  const [joinStatus, setJoinStatus] = useState(null)
  const [platformUser, setPlatformUser] = useState(null)
  const [openProfileEditSignal, setOpenProfileEditSignal] = useState(0)
  const [courtGridDate, setCourtGridDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [bookingModal, setBookingModal] = useState(null)
  const [paymentShares, setPaymentShares] = useState([])
  const [paymentStyle, setPaymentStyle] = useState('single') // 'single' | 'split' — أسلوب الدفع
  const [paymentMethod, setPaymentMethod] = useState('at_club') // 'at_club' | 'credit_card' | 'mada' — طرق الدفع
  const [paymentGateways, setPaymentGateways] = useState(null) // platform_payment_gateways
  const [bookingFlowStep, setBookingFlowStep] = useState(1)
  // single: 1 duration → 2 style → 3 pay + confirm | split: 1 → 2 → 3 shares → 4 your pay method + confirm
  const [bookingSuccessId, setBookingSuccessId] = useState(null) // show success and link to my-bookings
  const bookingsSectionRef = React.useRef(null)
  const [activeLock, setActiveLock] = useState(null)
  const [activeLocks, setActiveLocks] = useState([])
  const [lockError, setLockError] = useState(null)
  const [loadRetrying, setLoadRetrying] = useState(false)
  const [trainingJoinModal, setTrainingJoinModal] = useState(null) // { booking, court } - للانضمام لجلسة تدريب
  const [trainingJoinSubmitting, setTrainingJoinSubmitting] = useState(false)
  const [trainingJoinPaymentStyle, setTrainingJoinPaymentStyle] = useState('single') // 'single' | 'split' — مطابق حجز الملاعب
  const [trainingJoinPaymentMethod, setTrainingJoinPaymentMethod] = useState('at_club')
  const [trainingJoinPaymentShares, setTrainingJoinPaymentShares] = useState([])
  const [trainingJoinStep, setTrainingJoinStep] = useState(1)
  const [hoveredRange, setHoveredRange] = useState(null) // { court, courtId, startSlot, endSlot } - نطاق التمرير للحجز
  const hasTouch = typeof window !== 'undefined' && 'ontouchstart' in window
  const touchSelectRef = React.useRef(null) // { court, courtId, dateStr, startSlot } during touch drag
  const rangeLeaveTimeoutRef = React.useRef(null) // تأخير مسح النطاق عند المغادرة لتجنب الوَمْض

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  const refreshClub = React.useCallback(() => {
    loadClubs()
    const c = getClubById(clubId)
    setClub(c || null)
  }, [clubId])

  useEffect(() => {
    refreshClub()
  }, [refreshClub])

  useEffect(() => {
    refreshClubsFromApi().then(() => {
      refreshClub()
      setPlatformUser(getCurrentPlatformUser())
    })
  }, [clubId])

  useEffect(() => {
    getStore('platform_payment_gateways').then(val => {
      if (val && typeof val === 'object') setPaymentGateways(val)
      else setPaymentGateways({ enabledChannels: { at_club: true, credit_card: false, mada: false, split: true } })
    }).catch(() => setPaymentGateways({ enabledChannels: { at_club: true, credit_card: false, mada: false, split: true } }))
  }, [])

  const effectivePaymentChannels = useMemo(
    () => getEffectivePaymentChannels(paymentGateways?.enabledChannels, club?.settings?.paymentEnabledChannels),
    [paymentGateways?.enabledChannels, club?.settings?.paymentEnabledChannels]
  )

  const bookingStepCount = paymentStyle === 'split' ? 4 : 3

  useEffect(() => {
    if (!bookingModal) return
    setBookingFlowStep(1)
    setPaymentStyle('single')
    setPaymentShares([])
    setPaymentMethod('at_club')
  }, [bookingModal?.court, bookingModal?.dateStr, bookingModal?.startTime, bookingModal?.fromRange])

  useEffect(() => {
    if (trainingJoinModal) {
      setTrainingJoinStep(1)
      setTrainingJoinPaymentStyle('single')
      setTrainingJoinPaymentMethod('at_club')
      setTrainingJoinPaymentShares([])
      setLockError(null)
    }
  }, [trainingJoinModal])

  useEffect(() => {
    const ch = effectivePaymentChannels
    if (!ch) return
    const isCurrentEnabled = trainingJoinPaymentMethod === 'at_club' ? ch.at_club !== false : !!ch[trainingJoinPaymentMethod]
    if (!isCurrentEnabled) {
      setTrainingJoinPaymentMethod(pickFirstPaymentMethod(ch))
    }
  }, [effectivePaymentChannels, trainingJoinPaymentMethod])

  useEffect(() => {
    const ch = effectivePaymentChannels
    if (!ch) return
    const isCurrentEnabled = paymentMethod === 'at_club' ? ch.at_club !== false : !!ch[paymentMethod]
    if (!isCurrentEnabled) {
      setPaymentMethod(pickFirstPaymentMethod(ch))
    }
  }, [effectivePaymentChannels, paymentMethod])

  useEffect(() => {
    const onPaymentPickStep =
      (paymentStyle === 'single' && bookingFlowStep === 3) ||
      (paymentStyle === 'split' && bookingFlowStep === 4)
    if (!onPaymentPickStep) return
    const ch = effectivePaymentChannels
    if (!ch) return
    const ok = paymentMethod === 'at_club' ? ch.at_club !== false : !!ch[paymentMethod]
    if (!ok) setPaymentMethod(pickFirstPaymentMethod(ch))
  }, [bookingFlowStep, paymentStyle, effectivePaymentChannels, paymentMethod])

  useEffect(() => {
    if (paymentStyle === 'single' && bookingFlowStep === 4) {
      setBookingFlowStep(3)
    }
  }, [paymentStyle, bookingFlowStep])

  useEffect(() => {
    if (effectivePaymentChannels?.split === false && paymentStyle === 'split') {
      setPaymentStyle('single')
      setPaymentShares([])
    }
  }, [effectivePaymentChannels?.split, paymentStyle])

  useEffect(() => {
    const onSynced = () => {
      refreshClub()
      setPlatformUser(getCurrentPlatformUser())
    }
    window.addEventListener('clubs-synced', onSynced)
    return () => window.removeEventListener('clubs-synced', onSynced)
  }, [refreshClub])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshClub()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshClub])

  useEffect(() => {
    if (!clubId || !courtGridDate) return
    const prevDate = shiftCalendarDateStr(courtGridDate, -1)
    Promise.all([
      bookingApi.getBookingLocks(clubId, courtGridDate),
      prevDate ? bookingApi.getBookingLocks(clubId, prevDate) : Promise.resolve([])
    ])
      .then(([today, yesterday]) => {
        const byId = new Map()
        ;(Array.isArray(yesterday) ? yesterday : []).forEach(l => { if (l?.id) byId.set(l.id, l) })
        ;(Array.isArray(today) ? today : []).forEach(l => { if (l?.id) byId.set(l.id, l) })
        setActiveLocks(Array.from(byId.values()))
      })
      .catch(() => setActiveLocks([]))
  }, [clubId, courtGridDate, club?.bookings])

  useEffect(() => {
    setPlatformUser(getCurrentPlatformUser())
  }, [joinStatus])

  useEffect(() => {
    setPlatformUser(getCurrentPlatformUser())
  }, [])

  // Re-fetch platformUser when club loads (handles refresh/race after bootstrap)
  useEffect(() => {
    if (club?.id) setPlatformUser(getCurrentPlatformUser())
  }, [club?.id])

  useEffect(() => {
    const onMemberUpdate = () => setPlatformUser(getCurrentPlatformUser())
    window.addEventListener('member-updated', onMemberUpdate)
    return () => window.removeEventListener('member-updated', onMemberUpdate)
  }, [])

  useEffect(() => () => {
    if (rangeLeaveTimeoutRef.current) clearTimeout(rangeLeaveTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (!bookingSuccessId) return
    const t = setTimeout(() => setBookingSuccessId(null), 8000)
    const scrollT = setTimeout(() => bookingsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 400)
    return () => { clearTimeout(t); clearTimeout(scrollT) }
  }, [bookingSuccessId])

  useEffect(() => {
    if (window.location.hash === '#court-booking') {
      const el = document.getElementById('court-booking')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [club?.id])

  const bookings = useMemo(() => {
    const list = (club?.bookings && Array.isArray(club.bookings)) ? club.bookings : getClubBookings(clubId)
    return list || []
  }, [clubId, club?.id, club?.bookings])
  const today = useMemo(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  }, [])

  const courtBookings = useMemo(() => {
    if (!platformUser?.id) return []
    return bookings
      .filter(b => !b.isTournament && (b.date || b.startDate))
      .filter(b => !['cancelled', 'expired'].includes((b.status || '').toString()))
      .filter((b) => memberRelatesToCourtBooking(b, platformUser))
      .map(b => ({ ...b, dateStr: (b.date || b.startDate || '').toString().split('T')[0] }))
      .filter(b => b.dateStr >= today)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr) || (a.startTime || '').localeCompare(b.startTime || ''))
      .slice(0, 30)
  }, [bookings, today, platformUser])

  const tournamentBookings = useMemo(() =>
    bookings.filter(b => b.isTournament && (b.date || b.startDate))
      .map(b => ({ ...b, dateStr: (b.date || b.startDate || '').toString().split('T')[0] })),
    [bookings]
  )

  const currentTournaments = useMemo(() =>
    tournamentBookings.filter(b => b.dateStr === today)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [tournamentBookings, today]
  )

  const futureTournaments = useMemo(() =>
    tournamentBookings.filter(b => b.dateStr > today)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr) || (a.startTime || '').localeCompare(b.startTime || ''))
      .slice(0, 20),
    [tournamentBookings, today]
  )

  const futureTournamentsUnassigned = useMemo(() =>
    futureTournaments.filter(b => isTournamentWithoutMembers(club, b)),
    [futureTournaments, club?.tournamentData, club?.id]
  )

  const futureTournamentsWithMembers = useMemo(() =>
    futureTournaments.filter(b => !isTournamentWithoutMembers(club, b)),
    [futureTournaments, club?.tournamentData, club?.id]
  )

  const storeCategories = useMemo(() => {
    const cat = club?.store?.categories
    const arr = Array.isArray(cat) ? cat : []
    return arr.slice().sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [club?.store?.categories])
  const storeProducts = useMemo(() => {
    const prod = club?.store?.products
    const arr = Array.isArray(prod) ? prod : []
    return arr.slice().sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [club?.store?.products])
  const productsByCategory = useMemo(() => {
    const byCat = {}
    storeProducts.forEach(p => {
      const cid = p.categoryId || '_uncategorized'
      if (!byCat[cid]) byCat[cid] = []
      byCat[cid].push(p)
    })
    return byCat
  }, [storeProducts])

  const storeOffers = Array.isArray(club?.store?.offers) ? club.store.offers : []
  const getProductPrice = (product, basePriceNum) => {
    const today = new Date().toISOString().split('T')[0]
    const active = storeOffers.filter(o => o.active && (!o.startDate || o.startDate <= today) && (!o.endDate || o.endDate >= today))
    let best = basePriceNum
    active.forEach(o => {
      const matchP = (Array.isArray(o.productIds) ? o.productIds : []).includes(product?.id)
      const matchC = (Array.isArray(o.categoryIds) ? o.categoryIds : []).includes(product?.categoryId)
      if (!matchP && !matchC) return
      const disc = o.type === 'percentage' ? basePriceNum * (Number(o.value) || 0) / 100 : Math.min(basePriceNum, Number(o.value) || 0)
      const p = basePriceNum - disc
      if (p < best) best = p
    })
    return Math.max(0, best)
  }

  const activeOffers = useMemo(() => {
    const raw = club?.offers
    const list = Array.isArray(raw) ? raw.slice() : []
    const todayStr = new Date().toISOString().split('T')[0]
    return list
      .filter(o => o.active !== false)
      .filter(o => !o.validFrom || o.validFrom <= todayStr)
      .filter(o => !o.validUntil || o.validUntil >= todayStr)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [club?.offers])

  const clubMembersList = React.useMemo(() => {
    try {
      return getClubMembersFromStorage(club?.id || '') || []
    } catch (_) {
      return []
    }
  }, [club?.id, joinStatus, platformUser?.id])

  const allPlatformMembersList = React.useMemo(() => {
    try {
      return getAllMembersFromStorage() || []
    } catch (_) {
      return []
    }
  }, [club?.id])

  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingDuration, setBookingDuration] = useState(60)
  const durationOptions = useMemo(() => {
    const fromSettings = getPublicPricedDurationOptions(club)
    const fallback = fromSettings.length > 0 ? fromSettings : [{ durationMinutes: 60, price: 0 }]
    if (!bookingModal?.court || !bookingModal?.dateStr || !bookingModal?.startTime) {
      return fallback
    }
    const court = bookingModal.court
    const blocked = getBlockedRangesForCourtAndDate(court, bookingModal.dateStr, bookings, activeLocks, activeLock?.lockId || null, 0)
    const nextD = shiftCalendarDateStr(bookingModal.dateStr, 1)
    const blockedNext = nextD ? getBlockedRangesForCourtAndDate(court, nextD, bookings, activeLocks, activeLock?.lockId || null, 0) : []
    const mergedToday = getMergedWindowsForDate(club?.settings, bookingModal.dateStr)
    const mergedNext = nextD ? getMergedWindowsForDate(club?.settings, nextD) : []
    const minForAvail = getMinPricedDurationMinutes(club)
    const availableSet = new Set(getAvailableDurations(minForAvail, bookingModal.startTime, mergedToday, mergedNext, blocked, blockedNext))
    const filtered = fromSettings.filter(d => availableSet.has(d.durationMinutes))
    return filtered.length > 0 ? filtered : fallback
  }, [club, club?.settings?.workingHoursSeasons, club?.settings?.openingTime, club?.settings?.closingTime, club?.settings?.bookingPrices?.durationPrices, bookingModal, bookings, activeLocks, activeLock?.lockId])

  useEffect(() => {
    if (bookingModal?.fromRange && bookingModal?.preselectDuration != null) {
      setBookingDuration(bookingModal.preselectDuration)
      return
    }
    if (bookingModal && durationOptions.length > 0) {
      const first = durationOptions[0].durationMinutes || 60
      setBookingDuration(prev => {
        const valid = durationOptions.some(d => d.durationMinutes === prev)
        return valid ? prev : first
      })
    }
  }, [bookingModal?.dateStr, bookingModal?.startTime, bookingModal?.fromRange, bookingModal?.preselectDuration, durationOptions])

  const isMember = club && platformUser && (
    platformUser.clubIds?.includes(club.id) ||
    platformUser.clubId === club.id ||
    (Array.isArray(clubMembersList) && clubMembersList.some(m => String(m.id) === String(platformUser.id)))
  )

  /** هل الشريحة قابلة للحجز فعلياً؟ (وقت بداية صالح + مدة كافية + لا تعارض) */
  const isSlotActuallyBookable = useCallback((court, dateStr, startTime) => {
    if (!isSlotAValidBookableStart(club, dateStr, startTime)) return false
    const priced = getPublicPricedDurationOptions(club)
    const configured = priced.length > 0 ? priced.map(d => d.durationMinutes) : [60]
    const minForAvail = getMinPricedDurationMinutes(club)
    const blocked = getBlockedRangesForCourtAndDate(court, dateStr, bookings, activeLocks, null, 0)
    const nextD = shiftCalendarDateStr(dateStr, 1)
    const blockedNext = nextD ? getBlockedRangesForCourtAndDate(court, nextD, bookings, activeLocks, null, 0) : []
    const mergedToday = getMergedWindowsForDate(club?.settings, dateStr)
    const mergedNext = nextD ? getMergedWindowsForDate(club?.settings, nextD) : []
    const available = getAvailableDurations(minForAvail, startTime, mergedToday, mergedNext, blocked, blockedNext)
    const availableSet = new Set(available)
    const allowed = configured.filter(d => availableSet.has(d))
    return allowed.length > 0
  }, [club, club?.settings?.bookingPrices?.durationPrices, club?.settings?.workingHoursSeasons, club?.settings?.openingTime, club?.settings?.closingTime, bookings, activeLocks])

  const handleSlotClick = useCallback(async (court, dateStr, startTime, existingLock = null) => {
    if (!platformUser || !isMember) return
    if (isSlotInPast(dateStr, startTime)) {
      setLockError(language === 'en' ? 'Cannot book a date or time in the past. Please select a future slot.' : 'لا يمكن حجز تاريخ أو وقت سابق. يرجى اختيار وقت قادم.')
      return
    }
    setLockError(null)
    if (existingLock) {
      let lockDur = timeToMinutes(existingLock.end_time || '') - timeToMinutes(existingLock.start_time || '')
      if (lockDur <= 0) lockDur += 1440
      setActiveLock({ lockId: existingLock.id, expiresAt: existingLock.expires_at })
      setBookingModal({ court, dateStr, startTime: existingLock.start_time || startTime })
      setBookingDuration(lockDur > 0 ? lockDur : getMinPricedDurationMinutes(club))
      return
    }
    const priced = getPublicPricedDurationOptions(club)
    let configured = priced.length > 0 ? priced.map(d => d.durationMinutes) : [60]
    const blocked = getBlockedRangesForCourtAndDate(court, dateStr, bookings, activeLocks, null, 0)
    const nextD = shiftCalendarDateStr(dateStr, 1)
    const blockedNext = nextD ? getBlockedRangesForCourtAndDate(court, nextD, bookings, activeLocks, null, 0) : []
    const mergedToday = getMergedWindowsForDate(club?.settings, dateStr)
    const mergedNext = nextD ? getMergedWindowsForDate(club?.settings, nextD) : []
    const minForAvail = getMinPricedDurationMinutes(club)
    const available = getAvailableDurations(minForAvail, startTime, mergedToday, mergedNext, blocked, blockedNext)
    const availableSet = new Set(available)
    const allowed = configured.filter(d => availableSet.has(d))
    if (allowed.length === 0) {
      setLockError(language === 'en' ? 'No duration available; slot conflicts with another booking.' : 'لا توجد مدة متاحة؛ الوقت يتعارض مع حجز آخر.')
      return
    }
    const lockDur = Math.max(...allowed)
    const endTime = addMinutesToTime(startTime, lockDur)
    const lockMinutes = club?.settings?.lockMinutes ?? 10
    const courtId = (court?.id || court?.name || '').toString()
    try {
      const result = await bookingApi.acquireBookingLock({
        clubId,
        courtId,
        date: dateStr,
        startTime,
        endTime,
        memberId: platformUser.id,
        lockMinutes
      })
      if (result.lockId) {
        setActiveLock({ lockId: result.lockId, expiresAt: result.expiresAt })
        setBookingModal({ court, dateStr, startTime })
      }
    } catch (e) {
      if (e.status === 409 || e.message?.includes('SLOT_TAKEN')) {
        setLockError(language === 'en' ? 'This slot was just taken. Please choose another.' : 'هذا الوقت تم حجزه للتو. اختر وقتاً آخر.')
        refreshClub()
      } else {
        const msg = (e?.message || '').trim()
        const isNetwork = /failed to fetch|networkerror|load failed|network error/i.test(msg)
        const fallback = language === 'en' ? 'Could not reserve slot. Please try again.' : 'تعذر حجز الوقت. حاول مجدداً.'
        const networkMsg = language === 'en' ? 'Connection error. Check your network and try again.' : 'خطأ في الاتصال. تحقق من الشبكة وحاول مجدداً.'
        setLockError(isNetwork ? networkMsg : (msg || fallback))
      }
    }
  }, [clubId, platformUser, isMember, club?.settings?.bookingPrices?.durationPrices, club?.settings?.workingHoursSeasons, club?.settings?.openingTime, club?.settings?.closingTime, club?.settings?.lockMinutes, language, refreshClub, bookings, activeLocks, club])

  const maxBookingDuration = useMemo(() => getMaxPricedDurationMinutes(club), [club?.settings?.bookingPrices?.durationPrices])

  /** خطوة الشبكة والتظليل — نصف ساعة (لا تعتمد على Minimum booking duration) */
  const slotStepMinutes = PUBLIC_SLOT_STEP_MINUTES
  const minBookingDurationForHover = PUBLIC_SLOT_STEP_MINUTES

  const handleRangeClick = useCallback(async (court, dateStr, startSlot, endSlot, existingLock = null) => {
    if (existingLock) {
      handleSlotClick(court, dateStr, startSlot, existingLock)
      return
    }
    const courtIdStr = (court?.id || court?.name || '').toString()
    const startM = timeToMinutes(startSlot)
    const endM = timeToMinutes(endSlot)
    const duration = endM - startM + slotStepMinutes
    const minPriced = getMinPricedDurationMinutes(club)
    if (duration < minPriced) {
      handleSlotClick(court, dateStr, startSlot, null)
      return
    }
    const blocked = getBlockedRangesForCourtAndDate(court, dateStr, bookings, activeLocks, null, 0)
    const nextD = shiftCalendarDateStr(dateStr, 1)
    const blockedNext = nextD ? getBlockedRangesForCourtAndDate(court, nextD, bookings, activeLocks, null, 0) : []
    const mergedToday = getMergedWindowsForDate(club?.settings, dateStr)
    const mergedNext = nextD ? getMergedWindowsForDate(club?.settings, nextD) : []
    const maxCap = maxBookingDuration
    const available = getAvailableDurations(minPriced, startSlot, mergedToday, mergedNext, blocked, blockedNext, maxCap)
    const priced = getPublicPricedDurationOptions(club)
    const allowed = priced.length > 0 ? priced.map(d => d.durationMinutes) : [60]
    if (!available.includes(duration) || !allowed.includes(duration)) {
      setLockError(language === 'en' ? 'Selected range has conflicts. Try a shorter range.' : 'النطاق المحدد يتعارض مع حجز آخر. حدد نطاقاً أقصر.')
      setHoveredRange(null)
      return
    }
    const endTime = addMinutesToTime(endSlot, slotStepMinutes)
    setLockError(null)
    try {
      const result = await bookingApi.acquireBookingLock({
        clubId,
        courtId: courtIdStr,
        date: dateStr,
        startTime: startSlot,
        endTime,
        memberId: platformUser.id,
        lockMinutes: club?.settings?.lockMinutes ?? 10
      })
      if (result.lockId) {
        setActiveLock({ lockId: result.lockId, expiresAt: result.expiresAt })
        setBookingModal({ court, dateStr, startTime: startSlot, endTime, fromRange: true, preselectDuration: duration })
        setBookingDuration(duration)
        setHoveredRange(null)
      }
    } catch (e) {
      if (e.status === 409 || e.message?.includes('SLOT_TAKEN')) {
        setLockError(language === 'en' ? 'This slot was just taken. Please choose another.' : 'هذا الوقت تم حجزه للتو. اختر وقتاً آخر.')
        refreshClub()
      } else {
        setLockError(e?.message || (language === 'en' ? 'Could not reserve. Try again.' : 'تعذر الحجز. حاول مجدداً.'))
      }
      setHoveredRange(null)
    }
  }, [clubId, platformUser, club, club?.settings?.workingHoursSeasons, club?.settings?.openingTime, club?.settings?.closingTime, club?.settings?.lockMinutes, club?.settings?.bookingPrices?.durationPrices, bookings, activeLocks, language, refreshClub, handleSlotClick, maxBookingDuration, slotStepMinutes])

  const handleJoinTraining = useCallback(async () => {
    if (!trainingJoinModal?.booking || !platformUser || !isMember) return
    const b = trainingJoinModal.booking
    const dateStr = (b.date || b.startDate || '').toString().split('T')[0]
    if (isSlotInPast(dateStr, b.startTime || b.timeSlot)) {
      setLockError(language === 'en' ? 'This slot is in the past.' : 'هذا الوقت منتهٍ.')
      return
    }
    const totalAmt = parseFloat(b?.totalAmount) || 0
    const sharedSum = (trainingJoinPaymentShares || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    if (trainingJoinPaymentStyle === 'split' && sharedSum > totalAmt) return
    setTrainingJoinSubmitting(true)
    setLockError(null)
    try {
      const payStyle = trainingJoinPaymentStyle || 'single'
      const backendPayStyle = payStyle === 'single' ? 'full' : 'split'
      const isElectronic = trainingJoinPaymentMethod === 'credit_card' || trainingJoinPaymentMethod === 'mada'
      const res = await bookingApi.joinTrainingSlot({
        bookingId: b.id,
        clubId,
        memberId: platformUser.id,
        memberName: platformUser.name || platformUser.email || platformUser.displayName || '',
        paymentStyle: backendPayStyle,
        paymentMethod: trainingJoinPaymentMethod || 'at_club',
        paymentShares: payStyle === 'split' && (trainingJoinPaymentShares || []).length > 0 ? trainingJoinPaymentShares : undefined
      })
      setTrainingJoinModal(null)
      setTrainingJoinStep(1)
      setTrainingJoinPaymentShares([])
      if (res?.paymentUrl && isElectronic) {
        try {
          let path = res.paymentUrl.startsWith('http') ? (() => { const u = new URL(res.paymentUrl); return u.pathname + u.search })() : res.paymentUrl
          const base = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '') || ''
          if (base && path.startsWith(base)) path = path.slice(base.length) || '/'
          navigate(path)
        } catch (_) {
          navigate(res.paymentUrl)
        }
        return
      }
      refreshClub()
      await refreshClubsFromApi()
      loadClubs()
      const updatedClub = getClubById(clubId)
      if (updatedClub) setClub(updatedClub)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      setBookingSuccessId(true)
    } catch (e) {
      const msg = (e?.message || '').trim()
      let fullMsg = msg.includes('Training full')
        ? (language === 'en' ? 'This training session is full.' : 'حصة التدريب مكتملة.')
        : msg.includes('Already joined')
          ? (language === 'en' ? 'You have already joined this training.' : 'انضممت لهذه الحصة مسبقاً.')
          : (e?.status === 409
            ? (language === 'en' ? 'Unable to join. The slot may be full or you have already joined.' : 'تعذر الانضمام. قد تكون الحصة مكتملة أو انضممت مسبقاً.')
            : (msg || (language === 'en' ? 'Could not join. Try again.' : 'لم نتمكن من الانضمام. حاول مجدداً.')))
      setLockError(fullMsg)
    } finally {
      setTrainingJoinSubmitting(false)
    }
  }, [trainingJoinModal, platformUser, isMember, clubId, language, refreshClub, trainingJoinPaymentStyle, trainingJoinPaymentMethod, trainingJoinPaymentShares, navigate])

  const cancelRangeLeaveTimeout = useCallback(() => {
    if (rangeLeaveTimeoutRef.current) {
      clearTimeout(rangeLeaveTimeoutRef.current)
      rangeLeaveTimeoutRef.current = null
    }
  }, [])

  /** تظليل شقّ واحد فقط (نصف ساعة); اختيار المدة يتم من النافذة بعد النقر */
  const handleRangeMouseEnter = useCallback((court, dateStr, timeSlot, canBookForRange) => {
    cancelRangeLeaveTimeout()
    if (!canBookForRange) return
    const courtId = (court?.id || court?.name || '').toString()
    setHoveredRange({ court, courtId, startSlot: timeSlot, endSlot: timeSlot, fromCanBook: true })
  }, [cancelRangeLeaveTimeout])

  const handleRangeMouseLeave = useCallback(() => {
    if (rangeLeaveTimeoutRef.current) clearTimeout(rangeLeaveTimeoutRef.current)
    rangeLeaveTimeoutRef.current = setTimeout(() => setHoveredRange(null), 180)
  }, [])

  const handleTouchMoveRange = useCallback((e) => {
    if (!touchSelectRef.current || !e.touches?.[0]) return
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    if (!el?.getAttribute) return
    const courtId = el.getAttribute('data-court-id')
    const timeSlot = el.getAttribute('data-time-slot')
    const dateStr = el.getAttribute('data-date')
    if (!courtId || !timeSlot || !dateStr || el.getAttribute('data-can-book-range') !== '1') return
    if (courtId !== touchSelectRef.current.courtId) return
    setHoveredRange({
      court: touchSelectRef.current.court,
      courtId,
      startSlot: timeSlot,
      endSlot: timeSlot,
      fromCanBook: true
    })
  }, [])

  const handleTouchEndRange = useCallback(() => {
    touchSelectRef.current = null
  }, [])

  const handleCloseBookingModal = useCallback(() => {
    if (activeLock?.lockId) {
      bookingApi.releaseBookingLock(activeLock.lockId, clubId, bookingModal?.dateStr).catch(() => {})
      setActiveLock(null)
    }
    setBookingModal(null)
    setBookingFlowStep(1)
    setPaymentShares([])
    setPaymentStyle('single')
    setPaymentMethod('at_club')
    setLockError(null)
  }, [activeLock?.lockId, clubId, bookingModal?.dateStr])

  const handleRetryLoad = useCallback(async () => {
    if (loadRetrying) return
    setLoadRetrying(true)
    try {
      await refreshClubsFromApi()
      loadClubs()
      const c = getClubById(clubId)
      setClub(c || null)
    } finally {
      setLoadRetrying(false)
    }
  }, [clubId, loadRetrying])

  if (!club) {
    return (
      <div className="club-public-page commercial">
        <div className="club-public-loading" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: 16 }}>
          <p>{clubId
            ? (language === 'en' ? 'Club not found or server is busy.' : 'النادي غير موجود أو الخادم مشغول.')
            : (language === 'en' ? 'Loading...' : 'جاري التحميل...')}</p>
          {clubId && (
            <button type="button" onClick={handleRetryLoad} disabled={loadRetrying} className="club-public-retry-load-btn">
              {loadRetrying ? (language === 'en' ? 'Retrying...' : 'جاري إعادة المحاولة...') : (language === 'en' ? 'Retry' : 'إعادة المحاولة')}
            </button>
          )}
          <Link to="/" style={{ marginTop: 8 }}>{language === 'en' ? 'Back to home' : 'العودة للرئيسية'}</Link>
        </div>
      </div>
    )
  }

  const courts = Array.isArray(club.courts) ? club.courts.filter(c => !c.maintenance) : []
  const currency = club?.settings?.currency || 'SAR'
  const offers = activeOffers
  const { tournamentsCount, matchesCount } = getClubTournamentStats(club)
  const clubName = language === 'ar' && club.nameAr ? club.nameAr : club.name
  const tagline = language === 'ar' ? (club.taglineAr || club.tagline) : (club.tagline || club.taglineAr)
  const address = club.address ? (language === 'ar' && club.addressAr ? club.addressAr : club.address) : null
  const clubAdminSession = getClubAdminSession()
  const isClubAdmin = clubAdminSession && String(clubAdminSession.clubId) === String(clubId)

  const heroBgColor = club?.settings?.heroBgColor || '#ffffff'
  const heroBgOpacity = Math.min(1, Math.max(0, (club?.settings?.heroBgOpacity ?? 85) / 100))
  const heroBgStyle = (() => {
    const m = heroBgColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    if (m) return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${heroBgOpacity})`
    return heroBgColor
  })()

  const t = {
    en: {
      backToHome: 'Back to home',
      aboutClub: 'About the club',
      facilities: 'Facilities & courts',
      courtsCount: 'Courts',
      offers: 'Current offers',
      offersFromAdmin: 'Offers from the club',
      contact: 'Contact',
      address: 'Address',
      phone: 'Phone',
      email: 'Email',
      website: 'Website',
      joinClub: 'Join this club',
      joinSuccess: 'You have joined the club successfully.',
      alreadyMember: 'You are already a member of this club.',
      registerFirst: 'Register on the platform first',
      registerMembers: 'Register as member',
      loginPlatform: 'Login with PlayTix',
      registerThenJoin: 'You must register on PlayTix before joining a club. Register now, then return here to join.',
      tournaments: 'Tournaments',
      matches: 'Matches',
      members: 'Members',
      bookingsTable: 'Upcoming bookings',
      bookingsEmpty: 'No upcoming court bookings.',
      date: 'Date',
      time: 'Time',
      court: 'Court',
      customer: 'Customer',
      currentTournaments: 'Tournaments today',
      currentTournamentsEmpty: 'No tournaments scheduled for today.',
      futureTournaments: 'Upcoming tournaments',
      futureTournamentsEmpty: 'No upcoming tournaments scheduled.',
      futureTournamentsOpen: 'Upcoming — open registration',
      futureTournamentsOpenHint: 'No members assigned to teams yet.',
      futureTournamentsWithTeams: 'Upcoming — teams registered',
      kingOfCourt: 'King of the Court',
      socialTournament: 'Social Tournament',
      validUntil: 'Valid until',
      discount: 'off',
      storeTitle: 'Store',
      storeEmpty: 'No products in the store yet.',
      uncategorized: 'Other',
      sale: 'Sale',
      viewProduct: 'View',
      inStock: 'In stock',
      outOfStock: 'Out of stock',
      courtBooking: 'Court booking',
      selectDate: 'Select date',
      available: 'Available',
      booked: 'Booked',
      tournamentBooked: 'Tournament (King of the Court)',
      tournamentBookedSocial: 'Tournament (Social)',
      bookNow: 'Book now',
      bookingPrice: 'Price',
      confirmBooking: 'Confirm booking',
      bookingSuccess: 'Booking confirmed!',
      paymentStyle: 'Payment style',
      paymentStyleDesc: 'Who pays for this booking?',
      iPay: 'I pay',
      iPayDesc: 'I pay the full amount',
      splitWithOthers: 'Split with others',
      splitWithOthersDesc: 'Share the cost with other members',
      paymentMethod: 'Payment method',
      paymentMethodDesc: 'How do you pay?',
      payAtClub: 'Cash at club',
      payAtClubDesc: 'Pay with cash or card at the club',
      creditCard: 'Credit card (pay now)',
      mada: 'Mada (pay now)',
      electronicPayment: 'Electronic payment',
      payFromWallet: 'Club wallet',
      viewMyBookings: 'View my bookings',
      loginToBook: 'Login to book courts',
      courtPrices: 'Court booking prices',
      duration: 'Duration',
      price: 'Price',
      joinPromptTitle: 'You\'re one step away!',
      joinPromptText: 'Join this club now to book courts, participate in tournaments, and enjoy member benefits.',
      joinPreviouslyMemberHint: 'Previously a member? Refresh the page or ask the club to re-add you.',
      profileIncompleteText: 'Please complete your member registration details (profile, phone if needed, password) from your account.',
      profileIncompleteCta: 'Complete profile',
      joinTraining: 'Join training',
      joinTrainingPrice: 'Price (one slot)',
      totalPrice: 'Total price',
      trainingSessionsLabel: 'Training sessions',
      trainingPayAtClub: 'Pay at club',
      trainingPayDirect: 'Direct payment',
      trainingPaySplit: 'Share with others',
      trainingPayFull: 'Pay full amount',
      confirmJoinTraining: 'Confirm join',
      legendCourt: 'Court booking',
      legendCoach: 'Coach session',
      legendTournament: 'Tournament',
      schedulePrevDay: 'Previous day',
      scheduleNextDay: 'Next day',
      continueBooking: 'Continue',
      back: 'Back',
      trainingJoinCompletePayment: 'Complete payment',
      trainingJoinPaymentMethodStep: 'How would you like to pay?',
      trainingJoinMaxSplitHint: 'You can invite up to {n} people to share payment (coach limit for this session).',
    },
    ar: {
      backToHome: 'العودة للرئيسية',
      aboutClub: 'عن النادي',
      facilities: 'المرافق والملاعب',
      courtsCount: 'ملاعب',
      offers: 'العروض الحالية',
      offersFromAdmin: 'عروض النادي',
      contact: 'التواصل',
      address: 'العنوان',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      website: 'الموقع',
      joinClub: 'التسجيل كعضو في النادي',
      joinSuccess: 'تم انضمامك للنادي بنجاح.',
      alreadyMember: 'أنت عضو في هذا النادي مسبقاً.',
      registerFirst: 'سجّل في PlayTix أولاً',
      registerMembers: 'تسجيل الأعضاء',
      loginPlatform: 'تسجيل الدخول بحساب PlayTix',
      registerThenJoin: 'يجب التسجيل في PlayTix قبل الانضمام لأي نادي. سجّل الآن ثم عد هنا للانضمام.',
      tournaments: 'بطولات',
      matches: 'مباريات',
      members: 'أعضاء',
      bookingsTable: 'جدول الحجوزات القادمة',
      bookingsEmpty: 'لا توجد حجوزات ملاعب قادمة.',
      date: 'التاريخ',
      time: 'الوقت',
      court: 'الملعب',
      customer: 'العميل',
      currentTournaments: 'البطولات المقامة اليوم',
      currentTournamentsEmpty: 'لا توجد بطولات مجدولة لليوم.',
      futureTournaments: 'البطولات المجدولة القادمة',
      futureTournamentsEmpty: 'لا توجد بطولات مجدولة قادمة.',
      futureTournamentsOpen: 'قادمة — التسجيل مفتوح',
      futureTournamentsOpenHint: 'لم يُعيَّن أعضاء في الفرق بعد.',
      futureTournamentsWithTeams: 'قادمة — فرق مسجّلة',
      teamsRegisteredShort: 'الفرق',
      membersTotalShort: 'الأعضاء',
      membersInTeam: 'أعضاء',
      teamRosterTitle: 'الفرق والأعضاء',
      kingOfCourt: 'ملك الملعب',
      socialTournament: 'بطولة سوشيال',
      validUntil: 'صالح حتى',
      discount: 'خصم',
      storeTitle: 'المتجر',
      storeEmpty: 'لا توجد منتجات في المتجر بعد.',
      uncategorized: 'أخرى',
      sale: 'خصم',
      viewProduct: 'عرض',
      inStock: 'متوفر',
      outOfStock: 'غير متوفر',
      courtBooking: 'حجز الملاعب',
      selectDate: 'اختر التاريخ',
      available: 'متاح',
      booked: 'محجوز',
      tournamentBooked: 'بطولة (ملك الملعب)',
      tournamentBookedSocial: 'بطولة (سوشيال)',
      bookNow: 'احجز الآن',
      bookingPrice: 'السعر',
      confirmBooking: 'تأكيد الحجز',
      bookingSuccess: 'تم تأكيد الحجز!',
      paymentStyle: 'أسلوب الدفع',
      paymentStyleDesc: 'من يدفع ثمن هذا الحجز؟',
      iPay: 'أنا أدفع',
      iPayDesc: 'أدفع المبلغ كاملاً',
      splitWithOthers: 'أشارك الدفع مع آخرين',
      splitWithOthersDesc: 'تقسيم التكلفة مع أعضاء آخرين',
      paymentMethod: 'طريقة الدفع',
      paymentMethodDesc: 'كيف تدفع؟',
      payAtClub: 'كاش في النادي',
      payAtClubDesc: 'الدفع نقداً أو بالبطاقة في النادي',
      creditCard: 'البطاقة الائتمانية (ادفع الآن)',
      mada: 'متاب (ادفع الآن)',
      electronicPayment: 'الدفع الإلكتروني',
      payFromWallet: 'المحفظة (رصيد النادي)',
      viewMyBookings: 'عرض حجوزاتي',
      loginToBook: 'سجّل الدخول لحجز الملاعب',
      courtPrices: 'أسعار حجوزات الملاعب',
      duration: 'المدة',
      price: 'السعر',
      joinPromptTitle: 'أنت على بُعد خطوة واحدة!',
      joinPromptText: 'انضم للنادي الآن لحجز الملاعب والمشاركة في البطولات والاستفادة من مزايا العضوية.',
      joinPreviouslyMemberHint: 'كنت عضواً سابقاً؟ حدّث الصفحة أو اطلب من إدارة النادي إعادة ربط العضوية.',
      profileIncompleteText: 'يرجى استكمال بيانات تسجيل العضو (الملف، الجوال إن لزم، كلمة المرور) من حسابك أعلاه.',
      profileIncompleteCta: 'استكمال البيانات',
      joinTraining: 'انضم للتدريب',
      joinTrainingPrice: 'السعر (حصة واحدة)',
      totalPrice: 'الإجمالي',
      trainingSessionsLabel: 'حصص تدريب',
      trainingPayAtClub: 'الدفع في النادي',
      trainingPayDirect: 'الدفع مباشرة',
      trainingPaySplit: 'المشاركة مع أعضاء آخرين',
      trainingPayFull: 'الدفع كامل المبلغ',
      confirmJoinTraining: 'تأكيد الانضمام',
      legendCourt: 'حجز ملعب',
      legendCoach: 'حصة مدرب',
      legendTournament: 'بطولة',
      schedulePrevDay: 'اليوم السابق',
      scheduleNextDay: 'اليوم التالي',
      continueBooking: 'متابعة',
      back: 'رجوع',
      trainingJoinCompletePayment: 'استكمال الدفع',
      trainingJoinPaymentMethodStep: 'كيف تودُّ الدفع؟',
      trainingJoinMaxSplitHint: 'يمكنك إضافة حتى {n} مشاركاً للتقسيم (الحد الذي حدّده المدرب لهذه الحصة).',
    }
  }
  const c = t[language] || t.en

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      const iso = (dateStr || '').toString().trim()
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
      const d = dateOnly ? new Date(iso + 'T12:00:00') : new Date(iso)
      return d.toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    } catch (e) {
      return dateStr
    }
  }

  const goSchedulePrevDay = () => {
    const prev = shiftCalendarDateStr(courtGridDate, -1)
    if (prev && prev >= today) setCourtGridDate(prev)
  }

  const goScheduleNextDay = () => {
    const next = shiftCalendarDateStr(courtGridDate, 1)
    if (next) setCourtGridDate(next)
  }

  const tournamentTypeName = (type) => type === 'social' ? c.socialTournament : c.kingOfCourt

  const handleJoinClub = async () => {
    if (isMember) {
      setJoinStatus('already')
      return
    }
    if (!platformUser) {
      navigate(`/register?join=${clubId}`)
      return
    }
    try {
      await bookingApi.joinClub(club.id, platformUser.id)
      await upsertMember({
        id: platformUser.id,
        name: platformUser.name,
        email: platformUser.email,
        phone: platformUser.phone,
        mobile: platformUser.mobile,
        avatar: platformUser.avatar
      })
      await addMemberToClub(platformUser.id, club.id)
      await refreshClubsFromApi()
      setPlatformUser(getCurrentPlatformUser())
      refreshClub()
      setJoinStatus('success')
      const memberEmail = (platformUser.email || '').trim()
      if (memberEmail && memberEmail.includes('@')) {
        sendWelcomeClubJoinEmail(memberEmail, platformUser.name || '', club.name || club.nameAr || '').catch(() => {})
      }
    } catch (e) {
      console.error('Join club failed:', e)
      setJoinStatus('error')
    }
  }

  const handleConfirmBooking = async () => {
    if (!bookingModal || !platformUser || !isMember) return
    const bookingDate = (bookingModal.dateStr || '').toString().replace(/T.*$/, '')
    if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      setLockError(language === 'en' ? 'Invalid date. Please select the date again.' : 'تاريخ غير صالح. يرجى اختيار التاريخ مرة أخرى.')
      return
    }
    if (isSlotInPast(bookingDate, bookingModal.startTime)) {
      setLockError(language === 'en' ? 'This slot is in the past. Please select a future date and time.' : 'هذا الوقت منتهٍ. يرجى اختيار تاريخ ووقت قادمين.')
      return
    }
    const totalPrice = calculateBookingPrice(club, bookingDate, bookingModal.startTime, bookingDuration || 60).price
    const sharedSum = (paymentShares || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    if (paymentShares?.length > 0 && sharedSum > totalPrice) return
    const dur = bookingDuration || 60
    const endTime = addMinutesToTime(bookingModal.startTime || '00:00', dur)
    const courtId = (bookingModal.court?.name || bookingModal.court?.id || '').toString()
    const courtName = (bookingModal.court?.name || '').toString().trim()
    const memberName = platformUser.name || platformUser.email || platformUser.displayName || ''
    const priceResult = calculateBookingPrice(club, bookingDate, bookingModal.startTime, dur)
    setBookingSubmitting(true)
    setLockError(null)
    try {
      if (!activeLock?.lockId) {
        setLockError(language === 'en' ? 'Reservation expired. Please select the time slot again.' : 'انتهت صلاحية الحجز. يرجى اختيار الوقت مرة أخرى.')
        setBookingSubmitting(false)
        return
      }
      const idempotencyKey = `confirm_${activeLock.lockId}`
      const isSplit = paymentStyle === 'split' && paymentShares.length > 0
      const payAtClub = paymentMethod === 'at_club'
      const isWalletPay = paymentMethod === 'wallet'
      const isOnlinePayment = paymentMethod === 'credit_card' || paymentMethod === 'mada'
      const res = await bookingApi.confirmBooking({
        lockId: activeLock.lockId,
        clubId,
        courtId,
        date: bookingDate,
        startTime: bookingModal.startTime,
        endTime,
        memberId: platformUser.id,
        memberName,
        totalAmount: priceResult.price,
        paymentMethod: isSplit
          ? undefined
          : (payAtClub ? 'at_club' : (isWalletPay ? 'wallet' : (isOnlinePayment ? paymentMethod : undefined))),
        initiatorPaymentMethod: isSplit ? (paymentMethod || 'at_club') : undefined,
        paymentShares: isSplit ? paymentShares : undefined,
        idempotencyKey
      })
      const bookingId = res?.bookingId
      const paymentUrl = res?.paymentUrl
      setActiveLock(null)
      if (paymentUrl && bookingId) {
        setBookingModal(null)
        setPaymentShares([])
        setPaymentStyle('single')
        setPaymentMethod('at_club')
        try {
          let path = paymentUrl.startsWith('http') ? (() => { const u = new URL(paymentUrl); return u.pathname + u.search })() : paymentUrl
          const base = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '') || ''
          if (base && path.startsWith(base)) path = path.slice(base.length) || '/'
          navigate(path)
        } catch (_) {
          navigate(paymentUrl)
        }
        return
      }
      setBookingSuccessId(bookingId || true)
      setBookingModal(null)
      setPaymentShares([])
      setPaymentStyle('single')
      setPaymentMethod('at_club')
      setClub(prev => {
        if (!prev || prev.id !== clubId) return prev
        const isSplit = res?.status === 'pending_payments'
        const isPendingPayment = res?.status === 'pending_payment'
        const mins = (prev?.settings?.splitPaymentDeadlineMinutes ?? 30)
        const newBooking = {
          id: bookingId,
          date: bookingDate,
          startDate: bookingDate,
          startTime: bookingModal.startTime,
          endTime,
          courtId,
          courtName,
          memberId: platformUser.id,
          status: res?.status || 'confirmed',
          totalAmount: priceResult.price,
          paidAmount: (isSplit || isPendingPayment) ? 0 : priceResult.price,
          ...(isSplit && { initiatorPaymentMethod: paymentMethod || 'at_club' }),
          ...(!isSplit && payAtClub ? { paymentMethod: 'at_club', initiatorPaymentMethod: 'at_club' } : {}),
          ...(isSplit && { paymentDeadlineAt: new Date(Date.now() + mins * 60 * 1000).toISOString() })
        }
        const existing = Array.isArray(prev.bookings) ? prev.bookings : []
        return { ...prev, bookings: [...existing, newBooking] }
      })
      await refreshClubsFromApi()
      loadClubs()
      const updatedClub = getClubById(clubId)
      if (updatedClub) setClub(updatedClub)
      refreshClub()
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
    } catch (e) {
      console.error('Booking failed:', e)
      setLockError(e?.message || (language === 'en' ? 'Booking failed. Please try again.' : 'فشل الحجز. حاول مجدداً.'))
    } finally {
      setBookingSubmitting(false)
    }
  }

  return (
    <div className="club-public-page commercial">
      {bookingSuccessId && (
        <div className="club-public-booking-success-banner" role="alert">
          <span>{c.bookingSuccess}</span>
          <Link to={`/my-bookings?from=${clubId}`} className="club-public-booking-success-link" onClick={() => setBookingSuccessId(null)}>
            {c.viewMyBookings}
          </Link>
          <button type="button" className="club-public-booking-success-dismiss" onClick={() => setBookingSuccessId(null)} aria-label="Close">×</button>
        </div>
      )}
      <header
        className={`club-public-header${(club?.settings?.headerBgColor || club?.settings?.headerTextColor) ? ' has-custom-header-colors' : ''}`}
        style={{
          ...(club?.settings?.headerBgColor && { background: club.settings.headerBgColor }),
          ...(club?.settings?.headerTextColor && { color: club.settings.headerTextColor })
        }}
      >
        <div className="club-public-header-inner">
          <div className="club-public-header-left">
            {platformUser ? (
              <MemberAccountDropdown
                member={platformUser}
                onUpdate={() => setPlatformUser(getCurrentPlatformUser())}
                language={language}
                clubId={clubId}
                className="club-public-member-account"
                isCoach={club && (club?.memberCoaches || []).some(mc => String(mc) === String(platformUser?.id))}
                openProfileEditSignal={openProfileEditSignal}
              />
            ) : (
              <div className="club-public-auth-links">
                <Link to={`/login?join=${clubId}`} className="club-public-login-link">{c.loginPlatform}</Link>
              </div>
            )}
          </div>
          <div className="club-public-header-social">
            {(Array.isArray(club?.settings?.socialLinks) ? club.settings.socialLinks : []).filter(s => s?.url).map((item, idx) => (
              <SocialIcon
                key={idx}
                platform={item.platform || 'facebook'}
                url={item.url}
                iconColor={item.iconColor || '#ffffff'}
                textColor={item.textColor || '#333333'}
                size={36}
                className="club-public-social-icon"
              />
            ))}
          </div>
          <div className="club-public-header-right">
          <button
            type="button"
            className="club-public-lang"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            title={language === 'en' ? 'العربية' : 'English'}
            aria-label={language === 'en' ? 'Switch to Arabic' : 'التبديل للإنجليزية'}
          >
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} />
          </button>
          </div>
        </div>
      </header>

      {platformUser?.profileIncomplete && (
        <section className="club-public-profile-incomplete-banner" role="region" aria-live="polite">
          <div className="club-public-profile-incomplete-inner">
            <p className="club-public-profile-incomplete-text">{c.profileIncompleteText}</p>
            <button
              type="button"
              className="club-public-profile-incomplete-btn"
              onClick={() => setOpenProfileEditSignal((n) => n + 1)}
            >
              {c.profileIncompleteCta}
            </button>
          </div>
        </section>
      )}

      {club.banner ? (
        <section className="club-public-banner club-public-banner-with-hero">
          <img src={getImageUrl(club.banner)} alt="" className="club-public-banner-image" />
          {club.logo && (
            <div className="club-public-banner-logo-wrap">
              <img src={getImageUrl(club.logo)} alt="" className="club-public-banner-logo" />
            </div>
          )}
          <div
            className="club-public-hero-overlay"
            style={{
              background: heroBgStyle,
              color: club?.settings?.heroTextColor || '#475569'
            }}
          >
            <h1 className="club-public-hero-title" style={{ color: club?.settings?.heroTitleColor || '#0f172a' }}>{clubName}</h1>
            {tagline && <p className="club-public-hero-tagline" style={{ color: club?.settings?.heroTextColor || '#475569' }}>{tagline}</p>}
            <div className="club-public-hero-stats" style={{ color: club?.settings?.heroStatsColor || '#0f172a' }}>
              <span>{courts.length} {c.courtsCount}</span>
              <span>{clubMembersList.length || club.members?.length || 0} {c.members}</span>
              {tournamentsCount > 0 && <span>{tournamentsCount} {c.tournaments}</span>}
              {matchesCount > 0 && <span>{matchesCount} {c.matches}</span>}
            </div>
          </div>
        </section>
      ) : (
        <section className="club-public-hero club-public-hero-standalone">
          <div className="club-public-hero-inner" style={{ background: heroBgStyle, color: club?.settings?.heroTextColor || '#475569' }}>
            {club.logo && <img src={getImageUrl(club.logo)} alt="" className="club-public-logo" />}
            <h1 className="club-public-title" style={{ color: club?.settings?.heroTitleColor || '#0f172a' }}>{clubName}</h1>
            {tagline && <p className="club-public-tagline" style={{ color: club?.settings?.heroTextColor || '#475569' }}>{tagline}</p>}
            <div className="club-public-stats" style={{ color: club?.settings?.heroStatsColor || '#0f172a' }}>
              <span>{courts.length} {c.courtsCount}</span>
              <span>{clubMembersList.length || club.members?.length || 0} {c.members}</span>
              {tournamentsCount > 0 && <span>{tournamentsCount} {c.tournaments}</span>}
              {matchesCount > 0 && <span>{matchesCount} {c.matches}</span>}
            </div>
          </div>
        </section>
      )}

      {platformUser && !isMember && (
        <section className="club-public-join-prompt" role="region" aria-live="polite">
          <div className="club-public-join-prompt-inner">
            <h3 className="club-public-join-prompt-title">{c.joinPromptTitle}</h3>
            <p className="club-public-join-prompt-text">{c.joinPromptText}</p>
            <button type="button" className="club-public-join-prompt-btn" onClick={handleJoinClub}>
              {c.joinClub}
            </button>
            <p className="club-public-join-prompt-hint">{c.joinPreviouslyMemberHint}</p>
          </div>
        </section>
      )}

      <main className="club-public-main">

        <section id="court-booking" className="club-public-section club-public-court-booking">
          <div className="club-public-section-inner">
            <div className="club-public-court-booking-header">
              <label className="club-public-court-booking-date-label">{c.selectDate}</label>
              {isMember && (
                <>
                  <Link to={`/my-bookings?from=${clubId}`} className="club-public-my-bookings-link">
                    📅 {language === 'en' ? 'My Bookings' : 'حجوزاتي'}
                  </Link>
                  {(club?.memberCoaches || []).some(mc => String(mc) === String(platformUser?.id)) && (
                    <Link to={`/clubs/${clubId}/coach`} className="club-public-coach-link">
                      🏸 {language === 'en' ? 'Coach Dashboard' : 'لوحة المدرب'}
                    </Link>
                  )}
                </>
              )}
              <CalendarPicker
                value={courtGridDate}
                onChange={setCourtGridDate}
                min={today}
                language={language}
                className="club-public-court-booking-date-input"
                aria-label={language === 'en' ? 'Select date' : 'اختر التاريخ'}
              />
            </div>
            {courts.length === 0 ? (
              <p className="club-public-no-data">{language === 'en' ? 'No courts listed.' : 'لا توجد ملاعب مسجلة.'}</p>
            ) : (() => {
              const timeSlots = getTimeSlotsForClub(club, courtGridDate)
              return (
                <div
                  className="club-public-court-booking-wrap club-public-court-booking-wrap--schedule"
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                >
                  <div className="club-public-court-booking-sticky-stack">
                    <div className="club-public-court-booking-date-nav">
                      <button
                        type="button"
                        className="club-public-court-booking-date-nav-btn"
                        onClick={goSchedulePrevDay}
                        disabled={courtGridDate <= today}
                        aria-label={c.schedulePrevDay}
                        title={c.schedulePrevDay}
                      >
                        <span className="club-public-court-booking-date-nav-icon" aria-hidden="true">‹</span>
                      </button>
                      <div className="club-public-court-booking-date-nav-label" aria-live="polite">
                        {formatDate(courtGridDate)}
                      </div>
                      <button
                        type="button"
                        className="club-public-court-booking-date-nav-btn"
                        onClick={goScheduleNextDay}
                        aria-label={c.scheduleNextDay}
                        title={c.scheduleNextDay}
                      >
                        <span className="club-public-court-booking-date-nav-icon" aria-hidden="true">›</span>
                      </button>
                    </div>
                    <div className="club-public-court-booking-schedule-legend" aria-hidden="true">
                      <span className="club-public-court-booking-legend-item">
                        <span className="club-public-legend-swatch club-public-legend-swatch--court" /> {c.legendCourt}
                      </span>
                      <span className="club-public-court-booking-legend-item">
                        <span className="club-public-legend-swatch club-public-legend-swatch--coach" /> {c.legendCoach}
                      </span>
                      <span className="club-public-court-booking-legend-item">
                        <span className="club-public-legend-swatch club-public-legend-swatch--tournament" /> {c.legendTournament}
                      </span>
                    </div>
                  </div>
                  <div
                    className="club-public-court-booking-grid-scroll"
                    onMouseEnter={cancelRangeLeaveTimeout}
                    onMouseLeave={handleRangeMouseLeave}
                    onTouchMove={hasTouch ? handleTouchMoveRange : undefined}
                    onTouchEnd={hasTouch ? handleTouchEndRange : undefined}
                    onTouchCancel={hasTouch ? handleTouchEndRange : undefined}
                  >
                  <div
                    className="club-public-court-grid club-public-court-grid-times-horizontal"
                    style={{
                      gridTemplateColumns: `var(--court-grid-sticky-w, 88px) repeat(${timeSlots.length}, minmax(var(--court-slot-min, 52px), 1fr))`,
                      gridTemplateRows: `auto repeat(${courts.length}, minmax(40px, auto))`,
                      minWidth: `calc(var(--court-grid-sticky-w, 88px) + ${timeSlots.length} * var(--court-slot-min, 52px))`
                    }}
                  >
                    <div className="club-public-court-grid-corner" />
                    {timeSlots.map(t => (
                      <div key={t} className="club-public-court-grid-time-header">{t}</div>
                    ))}
                    {courts.map(court => {
                      const blockedForCourt = getBlockedRangesForCourtAndDate(court, courtGridDate, bookings, activeLocks, null, 0)
                      return (
                      <React.Fragment key={court.id}>
                        <div className="club-public-court-grid-court-name">
                          {language === 'ar' && court.nameAr ? court.nameAr : court.name}
                        </div>
                        {timeSlots.map(timeSlot => {
                          const courtName = (court.name || '').toString().trim()
                          const courtIdForMatch = (court.id || court.name || '').toString()
                          const dateStr = courtGridDate
                          const bookedItem = bookings.find(b => {
                            if (isMemberCancelledBooking(b)) return false
                            const status = (b.status || '').toString().toLowerCase()
                            if (['cancelled', 'expired'].includes(status)) return false
                            const bDate = (b.date || b.startDate || '').toString().split('T')[0]
                            if (bDate !== dateStr) return false
                            if (b.isTournament) {
                              if (!kingTournamentReservesCourt(court, b)) return false
                            } else {
                              const res = (b.resource || b.court || b.courtId || '').toString().trim()
                              if (res !== courtName && res !== courtIdForMatch) return false
                            }
                            const start = (b.startTime || b.timeSlot || '').toString().trim()
                            let end = (b.endTime || '').toString().trim()
                            if (!end && start) {
                              const durMin = parseInt(b.durationMinutes, 10) || getMinPricedDurationMinutes(club)
                              end = addMinutesToTime(start, durMin)
                            }
                            return isTimeSlotCoveredByBooking(timeSlot, start, end || start)
                          })
                          const isBooked = !!bookedItem
                          const isTournamentBlock = isBooked && !!bookedItem?.isTournament
                          const isTraining = isBooked && !bookedItem?.isTournament && (bookedItem?.type === 'training' || bookedItem?.data?.type === 'training')
                          const isLocked = activeLocks.some(l => {
                            const lCourt = (l.court_id || '').toString()
                            if (lCourt !== courtName && lCourt !== courtIdForMatch) return false
                            const lDate = (l.booking_date || '').toString().split('T')[0]
                            if (lDate !== dateStr) return false
                            return isTimeSlotCoveredByBooking(timeSlot, l.start_time || '', l.end_time || '')
                          })
                          const myLock = activeLocks.find(l => {
                            const lCourt = (l.court_id || '').toString()
                            if (lCourt !== courtName && lCourt !== courtIdForMatch) return false
                            const lDate = (l.booking_date || '').toString().split('T')[0]
                            if (lDate !== dateStr) return false
                            const lockMemberId = (l.member_id ?? l.memberId ?? '').toString().trim()
                            const myId = (platformUser?.id ?? '').toString().trim()
                            if (lockMemberId !== myId) return false
                            return isTimeSlotCoveredByBooking(timeSlot, l.start_time || '', l.end_time || '')
                          })
                          const isMyLock = !!myLock
                          const isPast = isSlotInPast(dateStr, timeSlot)
                          const hasDuration = isSlotActuallyBookable(court, dateStr, timeSlot)
                          const coachIdForSlot = (bookedItem?.data?.coachId || bookedItem?.memberId || '').toString()
                          const isCoachForThisSlot = !!platformUser && String(platformUser.id) === coachIdForSlot
                          const maxTrainees = Math.min(4, Math.max(1, parseInt(bookedItem?.data?.maxTrainees, 10) || 4))
                          const trainees = (Array.isArray(bookedItem?.paymentShares) ? bookedItem.paymentShares : [])
                            .filter(s => (s.memberId || s.member_id || '').toString().trim() && String(s.memberId || s.member_id) !== coachIdForSlot)
                          const isTrainingFull = trainees.length >= maxTrainees
                          const myIdStr = (platformUser?.id ?? '').toString()
                          const isUserAlreadyJoined = trainees.some(s => String(s.memberId || s.member_id) === myIdStr)
                          const canJoinTraining = isTraining && isMember && platformUser && !isCoachForThisSlot && !isPast && !isTrainingFull && !isUserAlreadyJoined
                          const slotM = timeToMinutes(timeSlot)
                          const isInPreparation = !isBooked && !isLocked && overlapsAny(slotM, slotM + slotStepMinutes, blockedForCourt)
                          const canBook = !isBooked && !isInPreparation && !isPast && (hasDuration || isMyLock) && isMember && platformUser && (!isLocked || isMyLock)
                          const tournamentKindClass = isTournamentBlock ? (bookedItem?.tournamentType === 'social' ? 'tournament-social' : 'tournament-king') : ''
                          const cellStatus = isLocked ? 'in-progress' : isBooked ? (isTournamentBlock ? `booked tournament ${tournamentKindClass}` : isTraining ? (canJoinTraining ? 'booked training joinable' : 'booked training') : 'booked court-booking') : isInPreparation ? 'preparation' : isPast ? 'past' : 'available'
                          const slotTitle = isMyLock ? (language === 'en' ? 'Complete your booking' : 'أكمل حجزك') : isLocked ? (language === 'en' ? 'In progress' : 'قيد الإجراء') : canJoinTraining ? (language === 'en' ? 'Join training' : 'انضم للتدريب') : isTournamentBlock ? (bookedItem?.tournamentType === 'social' ? (c.tournamentBookedSocial || c.socialTournament) : (c.tournamentBooked || 'Tournament')) : isBooked ? (c.booked || 'Booked') : isInPreparation ? (language === 'en' ? 'Preparation time' : 'وقت الاستعداد') : isPast ? (language === 'en' ? 'Past' : 'منتهي') : canBook ? (c.bookNow || 'Book now') : (c.available || 'Available')
                          const isCellClickable = canBook || canJoinTraining
                          const canBookForRange = canBook && !isMyLock && !canJoinTraining
                          const isInRange = hoveredRange && hoveredRange.courtId === (court.id || court.name || '').toString() && (() => {
                            const slotM = timeToMinutes(timeSlot)
                            const startM = timeToMinutes(hoveredRange.startSlot)
                            const endM = timeToMinutes(hoveredRange.endSlot)
                            return slotM >= startM && slotM <= endM
                          })()
                          const isRangeBlockStart = isInRange && hoveredRange && timeToMinutes(timeSlot) === timeToMinutes(hoveredRange.startSlot)
                          const isRangeBlockContinuation = isInRange && !isRangeBlockStart
                          const rangeSpan = isRangeBlockStart && hoveredRange
                            ? Math.max(1, Math.round((timeToMinutes(hoveredRange.endSlot) - timeToMinutes(hoveredRange.startSlot)) / slotStepMinutes) + 1)
                            : 0
                          const trainingStart = bookedItem && (bookedItem.startTime || bookedItem.timeSlot || '').toString().trim()
                          const inferDur = parseInt(bookedItem?.durationMinutes, 10) || getMinPricedDurationMinutes(club)
                          const trainingEnd = (bookedItem?.endTime || '').toString().trim() || (trainingStart ? addMinutesToTime(trainingStart, inferDur) : '')
                          const isTrainingBlockStart = isTraining && timeToMinutes(timeSlot) === timeToMinutes(trainingStart)
                          const isTrainingBlockContinuation = isTraining && !isTrainingBlockStart
                          const trainingSpan = isTrainingBlockStart
                            ? Math.max(1, Math.round((timeToMinutes(trainingEnd) - timeToMinutes(trainingStart)) / slotStepMinutes))
                            : 0
                          const tournamentStart = isTournamentBlock ? (bookedItem.startTime || bookedItem.timeSlot || '').toString().trim() : ''
                          const tournamentEnd = isTournamentBlock
                            ? ((bookedItem.endTime || '').toString().trim() || (tournamentStart ? addMinutesToTime(tournamentStart, inferDur) : ''))
                            : ''
                          const isTournamentBlockStart = isTournamentBlock && tournamentStart && timeToMinutes(timeSlot) === timeToMinutes(tournamentStart)
                          const isTournamentBlockContinuation = isTournamentBlock && !isTournamentBlockStart
                          const tournamentSpan = isTournamentBlockStart && tournamentEnd
                            ? Math.max(1, Math.round((timeToMinutes(tournamentEnd) - timeToMinutes(tournamentStart)) / slotStepMinutes))
                            : 0
                          if (isTrainingBlockContinuation || isTournamentBlockContinuation) {
                            return null
                          }
                          if (isRangeBlockContinuation) {
                            return null
                          }
                          const handleCellClick = () => {
                            if (canJoinTraining) {
                              setTrainingJoinStep(1)
                              setTrainingJoinModal({ booking: bookedItem, court })
                              return
                            }
                            if (isMyLock) {
                              handleSlotClick(court, dateStr, timeSlot, myLock)
                              return
                            }
                            if (canBook) {
                              handleSlotClick(court, dateStr, timeSlot, null)
                            }
                          }
                          const gridSpan = trainingSpan > 0 ? trainingSpan : (tournamentSpan > 0 ? tournamentSpan : (rangeSpan > 0 ? rangeSpan : undefined))
                          const tournamentHue = isTournamentBlockStart ? tournamentAccentHue(bookedItem.tournamentId || bookedItem.id) : null
                          return (
                            <div
                              key={timeSlot}
                              role={isCellClickable ? 'button' : undefined}
                              tabIndex={isCellClickable ? 0 : undefined}
                              className={`club-public-court-grid-cell ${cellStatus} ${isCellClickable ? 'clickable' : ''} ${isInRange ? 'in-range hovered' : ''} ${isTrainingBlockStart ? 'training-block-merged' : ''} ${isTournamentBlockStart ? 'tournament-block-merged' : ''} ${isRangeBlockStart ? 'range-block-merged' : ''}`}
                              style={{
                                ...(gridSpan ? { gridColumn: `span ${gridSpan}` } : {}),
                                ...(tournamentHue != null ? { '--tournament-hue': String(tournamentHue) } : {})
                              }}
                              title={slotTitle}
                              {...(canBookForRange && { 'data-court-id': courtIdForMatch, 'data-date': dateStr, 'data-time-slot': timeSlot, 'data-can-book-range': '1' })}
                              onMouseEnter={canBookForRange ? () => handleRangeMouseEnter(court, dateStr, timeSlot, canBookForRange) : (isCellClickable ? () => setHoveredRange({ court, courtId: (court.id || court.name || '').toString(), startSlot: timeSlot, endSlot: timeSlot, fromCanBook: false }) : undefined)}
                              onTouchStart={hasTouch && canBookForRange ? () => { touchSelectRef.current = { court, courtId: courtIdForMatch, dateStr, startSlot: timeSlot } } : undefined}
                              onClick={isCellClickable ? handleCellClick : undefined}
                              onKeyDown={isCellClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellClick() } } : undefined}
                            >
                              {isTrainingBlockStart ? (
                                <span className="club-public-cell-training-block">
                                  <span className="club-public-cell-training-label">{c.trainingSessionsLabel}</span>
                                  <span className="club-public-cell-time-range">{trainingStart}{trainingEnd ? ` – ${trainingEnd}` : ''}</span>
                                </span>
                              ) : isTournamentBlockStart ? (
                                <span className="club-public-cell-tournament-block">
                                  <span className="club-public-cell-tournament-label">
                                    {bookedItem?.tournamentType === 'social' ? (c.socialTournament || 'Social') : (c.kingOfCourt || 'King')}
                                  </span>
                                  <span className="club-public-cell-time-range">{tournamentStart}{tournamentEnd ? ` – ${tournamentEnd}` : ''}</span>
                                </span>
                              ) : isRangeBlockStart ? (
                                <span className="club-public-cell-range-block" aria-hidden="true" />
                              ) : (
                                ''
                              )}
                            </div>
                          )
                        })}
                      </React.Fragment>
                    )
                    })}
                  </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </section>

        {lockError && (
          <div className="club-public-lock-error" role="alert">
            {lockError}
            <button type="button" onClick={() => setLockError(null)} aria-label="Dismiss">×</button>
          </div>
        )}
        {bookingModal && (
          <div className="club-public-booking-modal-backdrop" onClick={() => { if (!bookingSubmitting) handleCloseBookingModal() }} role="presentation">
            <div className="club-public-booking-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="booking-modal-title">
              <h3 id="booking-modal-title" className="club-public-booking-modal-title">{c.courtBooking}</h3>
              <div className="club-public-booking-stepper" aria-label={language === 'en' ? 'Booking steps' : 'خطوات الحجز'}>
                {Array.from({ length: bookingStepCount }, (_, i) => i + 1).map((n) => (
                  <React.Fragment key={n}>
                    {n > 1 && <span className={`club-public-booking-stepper-line ${bookingFlowStep >= n ? 'active' : ''}`} aria-hidden />}
                    <span
                      className={`club-public-booking-stepper-dot ${bookingFlowStep === n ? 'current' : ''} ${bookingFlowStep > n ? 'complete' : ''}`}
                      aria-current={bookingFlowStep === n ? 'step' : undefined}
                    >
                      {n}
                    </span>
                  </React.Fragment>
                ))}
              </div>
              <div className="club-public-booking-modal-body">
                {bookingFlowStep === 1 && (
                  <>
                    <p className="club-public-booking-modal-row">
                      <span>{c.court}:</span>
                      <strong>{language === 'ar' && bookingModal.court?.nameAr ? bookingModal.court.nameAr : (bookingModal.court?.name || '')}</strong>
                    </p>
                    <p className="club-public-booking-modal-row">
                      <span>{c.date}:</span>
                      <strong>{formatDate(bookingModal.dateStr)}</strong>
                    </p>
                    <p className="club-public-booking-modal-row">
                      <span>{c.time}:</span>
                      <strong>{bookingModal.startTime}{bookingModal.fromRange && bookingModal.endTime ? ` – ${bookingModal.endTime}` : ''}</strong>
                    </p>
                    <div className="club-public-booking-modal-row club-public-booking-modal-duration">
                      <label>{c.duration}:</label>
                      {bookingModal.fromRange && bookingModal.preselectDuration != null ? (
                        <div className="club-public-booking-duration-fixed">
                          <span className="duration-value">{bookingModal.preselectDuration} {language === 'en' ? 'min' : 'دقيقة'}</span>
                          <span className="duration-price">({parseFloat(calculateBookingPrice(club, bookingModal.dateStr, bookingModal.startTime, bookingModal.preselectDuration).price ?? 0).toFixed(0)} {currency})</span>
                        </div>
                      ) : (
                        <div className="club-public-booking-duration-btns">
                          {durationOptions.map(d => (
                            <button
                              key={d.durationMinutes}
                              type="button"
                              className={`club-public-booking-duration-btn ${bookingDuration === d.durationMinutes ? 'active' : ''}`}
                              onClick={() => setBookingDuration(d.durationMinutes)}
                            >
                              <span className="duration-value">{d.durationMinutes} {language === 'en' ? 'min' : 'د'}</span>
                              <span className="duration-price">{parseFloat(d.price != null ? d.price : 0).toFixed(0)} {currency}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="club-public-booking-modal-price">
                      <span>{c.bookingPrice}:</span>
                      <strong className="club-public-booking-modal-price-value">
                        {calculateBookingPrice(club, bookingModal.dateStr, bookingModal.startTime, bookingDuration).price} {currency}
                      </strong>
                    </div>
                  </>
                )}
                {bookingFlowStep >= 2 && (
                  <div className="club-public-booking-step-recap">
                    <span className="club-public-booking-step-recap-main">
                      {language === 'ar' && bookingModal.court?.nameAr ? bookingModal.court.nameAr : (bookingModal.court?.name || '')}
                    </span>
                    <span className="club-public-booking-step-recap-meta">
                      {formatDate(bookingModal.dateStr)} · {bookingModal.startTime}
                      {' · '}{bookingDuration}{language === 'en' ? ' min' : ' د'}
                      {' · '}{calculateBookingPrice(club, bookingModal.dateStr, bookingModal.startTime, bookingDuration).price} {currency}
                    </span>
                  </div>
                )}
                {bookingFlowStep === 2 && (
                  <div className="club-public-booking-payment-section">
                    <p className="club-public-booking-payment-section-title">{c.paymentStyle}</p>
                    <p className="club-public-booking-payment-section-desc">{c.paymentStyleDesc}</p>
                    <div className="club-public-booking-payment-style-btns">
                      <label className={`club-public-booking-payment-style-btn ${paymentStyle === 'single' ? 'active' : ''}`}>
                        <input type="radio" name="paymentStyle" checked={paymentStyle === 'single'} onChange={() => { setPaymentStyle('single'); setPaymentShares([]) }} />
                        <span className="style-label">{c.iPay}</span>
                        <span className="style-desc">{c.iPayDesc}</span>
                      </label>
                      {effectivePaymentChannels?.split !== false && (
                        <label className={`club-public-booking-payment-style-btn ${paymentStyle === 'split' ? 'active' : ''}`}>
                          <input type="radio" name="paymentStyle" checked={paymentStyle === 'split'} onChange={() => setPaymentStyle('split')} />
                          <span className="style-label">{c.splitWithOthers}</span>
                          <span className="style-desc">{c.splitWithOthersDesc}</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}
                {bookingFlowStep === 3 && paymentStyle === 'single' && (
                  <div className="club-public-booking-payment-method">
                    <p className="club-public-booking-payment-method-label">{c.paymentMethod}</p>
                    <p className="club-public-booking-payment-section-desc">{c.paymentMethodDesc}</p>
                    <div className="club-public-booking-payment-method-options">
                      {effectivePaymentChannels?.at_club !== false && (
                        <label className="club-public-booking-payment-radio">
                          <input type="radio" name="paymentMethod" checked={paymentMethod === 'at_club'} onChange={() => setPaymentMethod('at_club')} />
                          <span>{c.payAtClub}</span>
                        </label>
                      )}
                      {effectivePaymentChannels?.credit_card && (
                        <label className="club-public-booking-payment-radio">
                          <input type="radio" name="paymentMethod" checked={paymentMethod === 'credit_card'} onChange={() => setPaymentMethod('credit_card')} />
                          <span>{c.creditCard}</span>
                        </label>
                      )}
                      {effectivePaymentChannels?.mada && (
                        <label className="club-public-booking-payment-radio">
                          <input type="radio" name="paymentMethod" checked={paymentMethod === 'mada'} onChange={() => setPaymentMethod('mada')} />
                          <span>{c.mada}</span>
                        </label>
                      )}
                      {effectivePaymentChannels?.wallet && (
                        <label className="club-public-booking-payment-radio">
                          <input type="radio" name="paymentMethod" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} />
                          <span>{c.payFromWallet}</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}
                {bookingFlowStep === 3 && paymentStyle === 'split' && (
                  <div className="club-public-booking-payment-section">
                    <p className="club-public-booking-payment-section-title">{c.splitWithOthers}</p>
                    <p className="club-public-booking-payment-section-desc">{c.splitWithOthersDesc}</p>
                    <BookingPaymentShare
                      totalPrice={calculateBookingPrice(club, bookingModal.dateStr, bookingModal.startTime, bookingDuration).price}
                      currency={currency}
                      clubName={language === 'ar' && club?.nameAr ? club.nameAr : club?.name}
                      clubId={clubId}
                      dateStr={bookingModal.dateStr}
                      startTime={bookingModal.startTime}
                      clubMembers={clubMembersList}
                      allPlatformMembers={allPlatformMembersList}
                      currentMemberId={platformUser?.id}
                      language={language}
                      value={paymentShares}
                      onChange={setPaymentShares}
                    />
                  </div>
                )}
                {bookingFlowStep === 4 && paymentStyle === 'split' && (
                  <div className="club-public-booking-payment-method">
                    <p className="club-public-booking-payment-method-label">{language === 'en' ? 'Your payment method' : 'طريقة دفعتك'}</p>
                    <p className="club-public-booking-payment-section-desc">{language === 'en' ? 'How will you pay your share?' : 'كيف ستدفع حصتك؟'}</p>
                    <div className="club-public-booking-payment-method-options">
                      {effectivePaymentChannels?.at_club !== false && (
                        <label className="club-public-booking-payment-radio">
                          <input type="radio" name="paymentMethod" checked={paymentMethod === 'at_club'} onChange={() => setPaymentMethod('at_club')} />
                          <span>{c.payAtClub}</span>
                        </label>
                      )}
                      {effectivePaymentChannels?.credit_card && (
                        <label className="club-public-booking-payment-radio">
                          <input type="radio" name="paymentMethod" checked={paymentMethod === 'credit_card'} onChange={() => setPaymentMethod('credit_card')} />
                          <span>{c.creditCard}</span>
                        </label>
                      )}
                      {effectivePaymentChannels?.mada && (
                        <label className="club-public-booking-payment-radio">
                          <input type="radio" name="paymentMethod" checked={paymentMethod === 'mada'} onChange={() => setPaymentMethod('mada')} />
                          <span>{c.mada}</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {activeLock && (
                <p className="club-public-booking-lock-notice">
                  {language === 'en' ? '⏱ Slot reserved. Complete booking before the hold expires.' : '⏱ الوقت محجوز. أكمل الحجز قبل انتهاء الحجز المؤقت.'}
                </p>
              )}
              <div className="club-public-booking-modal-actions">
                {bookingFlowStep === 1 && (
                  <>
                    <button type="button" className="club-public-booking-modal-cancel" onClick={() => { if (!bookingSubmitting) handleCloseBookingModal() }} disabled={bookingSubmitting}>
                      {language === 'en' ? 'Cancel' : 'إلغاء'}
                    </button>
                    <button
                      type="button"
                      className="club-public-booking-gating-primary-btn"
                      onClick={() => { setBookingFlowStep(2); if (effectivePaymentChannels?.split === false) { setPaymentStyle('single'); setPaymentShares([]) } }}
                      disabled={bookingSubmitting || durationOptions.length === 0}
                    >
                      {c.continueBooking}
                    </button>
                  </>
                )}
                {bookingFlowStep === 2 && (
                  <>
                    <button type="button" className="club-public-booking-modal-back" onClick={() => setBookingFlowStep(1)} disabled={bookingSubmitting}>
                      {c.back}
                    </button>
                    <button
                      type="button"
                      className="club-public-booking-gating-primary-btn"
                      onClick={() => {
                        setBookingFlowStep(3)
                        if (paymentStyle === 'single') {
                          setPaymentMethod(pickFirstPaymentMethod(effectivePaymentChannels))
                        }
                      }}
                      disabled={bookingSubmitting}
                    >
                      {c.continueBooking}
                    </button>
                  </>
                )}
                {bookingFlowStep === 3 && paymentStyle === 'single' && (
                  <>
                    <button type="button" className="club-public-booking-modal-back" onClick={() => setBookingFlowStep(2)} disabled={bookingSubmitting}>
                      {c.back}
                    </button>
                    <button
                      type="button"
                      className="club-public-booking-modal-confirm"
                      onClick={handleConfirmBooking}
                      disabled={bookingSubmitting}
                    >
                      {bookingSubmitting ? (language === 'en' ? 'Booking...' : 'جاري الحجز...') : c.confirmBooking}
                    </button>
                  </>
                )}
                {bookingFlowStep === 3 && paymentStyle === 'split' && (
                  <>
                    <button type="button" className="club-public-booking-modal-back" onClick={() => setBookingFlowStep(2)} disabled={bookingSubmitting}>
                      {c.back}
                    </button>
                    <button
                      type="button"
                      className="club-public-booking-gating-primary-btn"
                      onClick={() => {
                        setBookingFlowStep(4)
                        setPaymentMethod(pickFirstPaymentMethod(effectivePaymentChannels))
                      }}
                      disabled={
                        bookingSubmitting ||
                        (paymentShares || []).length === 0 ||
                        (paymentShares || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) > calculateBookingPrice(club, bookingModal.dateStr, bookingModal.startTime, bookingDuration).price
                      }
                    >
                      {c.continueBooking}
                    </button>
                  </>
                )}
                {bookingFlowStep === 4 && paymentStyle === 'split' && (
                  <>
                    <button type="button" className="club-public-booking-modal-back" onClick={() => setBookingFlowStep(3)} disabled={bookingSubmitting}>
                      {c.back}
                    </button>
                    <button
                      type="button"
                      className="club-public-booking-modal-confirm"
                      onClick={handleConfirmBooking}
                      disabled={
                        bookingSubmitting ||
                        (paymentShares || []).length === 0 ||
                        (paymentShares || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) > calculateBookingPrice(club, bookingModal.dateStr, bookingModal.startTime, bookingDuration).price
                      }
                    >
                      {bookingSubmitting ? (language === 'en' ? 'Booking...' : 'جاري الحجز...') : c.confirmBooking}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {trainingJoinModal && (() => {
          const bTrain = trainingJoinModal.booking
          const dTrain = bTrain?.data && typeof bTrain.data === 'object' ? bTrain.data : {}
          const maxTraineesCap = Math.min(4, Math.max(1, parseInt(dTrain.maxTrainees, 10) || 4))
          const maxSplitOthers = Math.max(0, maxTraineesCap - 1)
          const splitAllowed = effectivePaymentChannels?.split !== false && maxSplitOthers > 0
          const maxSplitHintStr = c.trainingJoinMaxSplitHint.replace(/\{n\}/g, String(maxSplitOthers))
          const dateStrTrain = (bTrain?.date || bTrain?.startDate || '').toString().split('T')[0]
          const courtLabelTrain = language === 'ar' && trainingJoinModal.court?.nameAr ? trainingJoinModal.court.nameAr : (trainingJoinModal.court?.name || '')
          const recapTrain = `${courtLabelTrain} · ${formatDate(dateStrTrain)} · ${bTrain?.startTime || bTrain?.timeSlot || ''} – ${bTrain?.endTime || ''} · ${(parseFloat(bTrain?.totalAmount) || 0).toFixed(2)} ${currency}`
          const joinPrice = parseFloat(bTrain?.totalAmount) || 0
          const splitSumInvalid = trainingJoinPaymentStyle === 'split' && (trainingJoinPaymentShares || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) > joinPrice
          return (
          <div className="club-public-booking-modal-backdrop" onClick={() => { if (!trainingJoinSubmitting) { setTrainingJoinModal(null); setTrainingJoinStep(1); setLockError(null) } }} role="presentation">
            <div className="club-public-booking-modal club-public-training-join-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="join-training-modal-title">
              <h3 id="join-training-modal-title" className="club-public-booking-modal-title">{c.joinTraining}</h3>
              <div className="club-public-booking-stepper" aria-label={language === 'en' ? 'Join training steps' : 'خطوات الانضمام للتدريب'}>
                {[1, 2, 3, 4].map((n) => (
                  <React.Fragment key={n}>
                    {n > 1 && <span className={`club-public-booking-stepper-line ${trainingJoinStep >= n ? 'active' : ''}`} aria-hidden />}
                    <span
                      className={`club-public-booking-stepper-dot ${trainingJoinStep === n ? 'current' : ''} ${trainingJoinStep > n ? 'complete' : ''}`}
                      aria-current={trainingJoinStep === n ? 'step' : undefined}
                    >
                      {n}
                    </span>
                  </React.Fragment>
                ))}
              </div>
              {lockError && (
                <div className="club-public-booking-modal-error" role="alert">
                  {lockError}
                  <button type="button" onClick={() => setLockError(null)} aria-label={language === 'en' ? 'Dismiss' : 'إغلاق'}>×</button>
                </div>
              )}
              <div className="club-public-booking-modal-body">
                {trainingJoinStep === 1 && (
                  <>
                    <p className="club-public-booking-modal-row club-public-training-join-summary-row">
                      <span>{c.court}:</span>
                      <strong>{courtLabelTrain}</strong>
                    </p>
                    <p className="club-public-booking-modal-row club-public-training-join-summary-row">
                      <span>{c.date}:</span>
                      <strong>{formatDate(dateStrTrain)}</strong>
                    </p>
                    <p className="club-public-booking-modal-row club-public-training-join-summary-row">
                      <span>{c.time}:</span>
                      <strong>{bTrain?.startTime || bTrain?.timeSlot || ''} – {bTrain?.endTime || ''}</strong>
                    </p>
                    <div className="club-public-booking-modal-price club-public-training-join-total">
                      <span>{c.totalPrice}:</span>
                      <strong className="club-public-booking-modal-price-value">
                        {joinPrice.toFixed(2)} {currency}
                      </strong>
                    </div>
                  </>
                )}
                {trainingJoinStep === 2 && (
                  <>
                    <div className="club-public-booking-step-recap">
                      <span className="club-public-booking-step-recap-main">{recapTrain}</span>
                    </div>
                    <div className="club-public-booking-payment-section">
                      <p className="club-public-booking-payment-section-title">{c.paymentStyle}</p>
                      <p className="club-public-booking-payment-section-desc">{c.paymentStyleDesc}</p>
                      <div className="club-public-booking-payment-style-btns">
                        <label className={`club-public-booking-payment-style-btn ${trainingJoinPaymentStyle === 'single' ? 'active' : ''}`}>
                          <input type="radio" name="trainingPaymentStyle" checked={trainingJoinPaymentStyle === 'single'} onChange={() => { setTrainingJoinPaymentStyle('single'); setTrainingJoinPaymentShares([]) }} />
                          <span className="style-label">{c.iPay}</span>
                          <span className="style-desc">{c.iPayDesc}</span>
                        </label>
                        {splitAllowed && (
                          <label className={`club-public-booking-payment-style-btn ${trainingJoinPaymentStyle === 'split' ? 'active' : ''}`}>
                            <input type="radio" name="trainingPaymentStyle" checked={trainingJoinPaymentStyle === 'split'} onChange={() => setTrainingJoinPaymentStyle('split')} />
                            <span className="style-label">{c.splitWithOthers}</span>
                            <span className="style-desc">{c.splitWithOthersDesc}</span>
                          </label>
                        )}
                      </div>
                      {!splitAllowed && (
                        <p className="club-public-training-join-split-unavailable">
                          {language === 'en' ? 'Sharing payment is not available for this session (coach capacity is 1 or club settings).' : 'مشاركة الدفع غير متاحة لهذه الحصة (سعة المدرب 1 أو إعدادات النادي).'}
                        </p>
                      )}
                    </div>
                  </>
                )}
                {trainingJoinStep === 3 && (
                  <>
                    <div className="club-public-booking-step-recap">
                      <span className="club-public-booking-step-recap-main">{recapTrain}</span>
                      <span className="club-public-booking-step-recap-meta">
                        {trainingJoinPaymentStyle === 'split' ? c.splitWithOthers : c.iPay}
                      </span>
                    </div>
                    {trainingJoinPaymentStyle === 'split' && (
                      <BookingPaymentShare
                        totalPrice={joinPrice}
                        currency={currency}
                        clubName={language === 'ar' && club?.nameAr ? club.nameAr : club?.name}
                        clubId={clubId}
                        dateStr={dateStrTrain}
                        startTime={bTrain?.startTime || bTrain?.timeSlot || ''}
                        clubMembers={clubMembersList}
                        allPlatformMembers={allPlatformMembersList}
                        currentMemberId={platformUser?.id}
                        language={language}
                        value={trainingJoinPaymentShares}
                        onChange={setTrainingJoinPaymentShares}
                        hideHeaderToggle
                        maxShareCount={maxSplitOthers}
                        maxShareHint={maxSplitHintStr}
                      />
                    )}
                  </>
                )}
                {trainingJoinStep === 4 && (
                  <>
                    <div className="club-public-booking-step-recap">
                      <span className="club-public-booking-step-recap-main">{recapTrain}</span>
                      <span className="club-public-booking-step-recap-meta">
                        {trainingJoinPaymentStyle === 'split' ? c.splitWithOthers : c.iPay}
                      </span>
                    </div>
                    <div className="club-public-booking-payment-method club-public-training-join-final-pay">
                      <p className="club-public-booking-payment-method-label">{c.trainingJoinCompletePayment}</p>
                      <p className="club-public-booking-payment-section-desc">{c.trainingJoinPaymentMethodStep}</p>
                      <div className="club-public-booking-payment-method-options">
                        {effectivePaymentChannels?.at_club !== false && (
                          <label className="club-public-booking-payment-radio">
                            <input type="radio" name="trainingPaymentMethod" checked={trainingJoinPaymentMethod === 'at_club'} onChange={() => setTrainingJoinPaymentMethod('at_club')} />
                            <span>{c.payAtClub}</span>
                          </label>
                        )}
                        {effectivePaymentChannels?.credit_card && (
                          <label className="club-public-booking-payment-radio">
                            <input type="radio" name="trainingPaymentMethod" checked={trainingJoinPaymentMethod === 'credit_card'} onChange={() => setTrainingJoinPaymentMethod('credit_card')} />
                            <span>{c.creditCard}</span>
                          </label>
                        )}
                        {effectivePaymentChannels?.mada && (
                          <label className="club-public-booking-payment-radio">
                            <input type="radio" name="trainingPaymentMethod" checked={trainingJoinPaymentMethod === 'mada'} onChange={() => setTrainingJoinPaymentMethod('mada')} />
                            <span>{c.mada}</span>
                          </label>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="club-public-booking-modal-actions">
                {trainingJoinStep === 1 && (
                  <>
                    <button type="button" className="club-public-booking-modal-cancel" onClick={() => { if (!trainingJoinSubmitting) { setTrainingJoinModal(null); setTrainingJoinStep(1); setLockError(null) } }} disabled={trainingJoinSubmitting}>
                      {language === 'en' ? 'Cancel' : 'إلغاء'}
                    </button>
                    <button type="button" className="club-public-booking-modal-confirm" onClick={() => setTrainingJoinStep(2)} disabled={trainingJoinSubmitting}>
                      {c.continueBooking}
                    </button>
                  </>
                )}
                {trainingJoinStep === 2 && (
                  <>
                    <button type="button" className="club-public-booking-modal-cancel" onClick={() => setTrainingJoinStep(1)} disabled={trainingJoinSubmitting}>
                      {c.back}
                    </button>
                    <button
                      type="button"
                      className="club-public-booking-modal-confirm"
                      onClick={() => setTrainingJoinStep(3)}
                      disabled={trainingJoinSubmitting || (trainingJoinPaymentStyle === 'split' && !splitAllowed)}
                    >
                      {c.continueBooking}
                    </button>
                  </>
                )}
                {trainingJoinStep === 3 && (
                  <>
                    <button type="button" className="club-public-booking-modal-cancel" onClick={() => setTrainingJoinStep(2)} disabled={trainingJoinSubmitting}>
                      {c.back}
                    </button>
                    <button
                      type="button"
                      className="club-public-booking-modal-confirm"
                      onClick={() => {
                        setTrainingJoinStep(4)
                        setTrainingJoinPaymentMethod(pickFirstPaymentMethod(effectivePaymentChannels))
                      }}
                      disabled={
                        trainingJoinSubmitting ||
                        (trainingJoinPaymentStyle === 'split' && (
                          (trainingJoinPaymentShares || []).length === 0 ||
                          (trainingJoinPaymentShares || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) > joinPrice
                        ))
                      }
                    >
                      {c.continueBooking}
                    </button>
                  </>
                )}
                {trainingJoinStep === 4 && (
                  <>
                    <button type="button" className="club-public-booking-modal-cancel" onClick={() => setTrainingJoinStep(3)} disabled={trainingJoinSubmitting}>
                      {c.back}
                    </button>
                    <button
                      type="button"
                      className="club-public-booking-modal-confirm"
                      onClick={handleJoinTraining}
                      disabled={trainingJoinSubmitting || splitSumInvalid}
                    >
                      {trainingJoinSubmitting ? (language === 'en' ? 'Joining...' : 'جاري الانضمام...') : c.confirmJoinTraining}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          )
        })()}

        <section ref={bookingsSectionRef} className="club-public-section club-public-upcoming-block">
          <div className="club-public-section-inner">
            <h2 className="section-heading club-public-upcoming-heading">
              <span className="section-heading-icon">📅</span>
              {platformUser ? (language === 'en' ? 'My Bookings' : 'حجوزاتي') : (language === 'en' ? 'Your Bookings' : 'حجوزاتك')}
            </h2>
            {!platformUser ? (
              <div className="club-public-upcoming-login-cta">
                <p className="club-public-upcoming-login-text">{language === 'en' ? 'Log in to see your bookings' : 'سجّل دخولك لرؤية حجوزاتك'}</p>
                <Link to={`/login?join=${clubId}`} className="club-public-upcoming-login-btn">{c.loginPlatform}</Link>
              </div>
            ) : courtBookings.length === 0 ? (
              <p className="club-public-no-data club-public-upcoming-empty">{c.bookingsEmpty}</p>
            ) : (
              <>
                <div className="club-public-upcoming-countdown">
                  <div className="club-public-upcoming-countdown-grid">
                    {courtBookings.map((b, i) => (
                      <BookingCountdownCard
                        key={b.id || i}
                        booking={b}
                        formatDate={formatDate}
                        language={language}
                        to={
                          platformUser && clubId && b.id
                            ? `/my-bookings?from=${encodeURIComponent(clubId)}&booking=${encodeURIComponent(String(b.id))}`
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="club-public-section club-public-court-prices">
          <div className="club-public-section-inner">
            <h2 className="section-heading">
              <span className="section-heading-icon">💰</span>
              {c.courtPrices}
            </h2>
            {(() => {
              const bp = club?.settings?.bookingPrices && typeof club.settings.bookingPrices === 'object' ? club.settings.bookingPrices : {}
              const durationPrices = (Array.isArray(bp.durationPrices) ? bp.durationPrices : [{ durationMinutes: 60, price: 100 }])
                .sort((a, b) => (a.durationMinutes || 0) - (b.durationMinutes || 0))
              const dm = Array.isArray(bp.dayModifiers) ? bp.dayModifiers : []
              const tm = Array.isArray(bp.timeModifiers) ? bp.timeModifiers : []
              const sm = Array.isArray(bp.seasonModifiers) ? bp.seasonModifiers : []
              const hasModifiers = (dm.length > 0 && dm.some(d => (d.multiplier || 1) !== 1)) ||
                (tm.length > 0 && tm.some(t => (t.multiplier || 1) !== 1)) ||
                (sm.length > 0 && sm.some(s => (s.multiplier || 1) !== 1))
              return (
                <div className="club-public-prices-wrap">
                  <div className="club-public-prices-grid">
                    {durationPrices.map((d, i) => (
                      <div key={i} className="club-public-price-card">
                        <span className="club-public-price-card__duration">{d.durationMinutes} {language === 'en' ? 'min' : 'دقيقة'}</span>
                        <span className="club-public-price-card__price">{parseFloat(d.price || 0).toFixed(0)} {currency}</span>
                      </div>
                    ))}
                  </div>
                  {hasModifiers && (
                    <p className="club-public-prices-note">
                      {language === 'en' ? 'Prices may vary by day, time, and season.' : 'قد تختلف الأسعار حسب اليوم والوقت والموسم.'}
                    </p>
                  )}
                </div>
              )
            })()}
          </div>
        </section>

        <section className="club-public-section club-public-offers">
          <div className="club-public-section-inner">
            {offers.length === 0 ? (
              <p className="club-public-no-data">{language === 'en' ? 'No offers at the moment.' : 'لا توجد عروض حالياً.'}</p>
            ) : (
              <div className="club-public-offers-grid">
                {offers.map((offer, i) => {
                  const title = language === 'ar' ? (offer.titleAr || offer.nameAr || offer.title || offer.name) : (offer.title || offer.name)
                  const desc = language === 'ar' ? (offer.descriptionAr || offer.description) : (offer.description || offer.descriptionAr)
                  return (
                    <div key={offer.id || i} className="club-public-offer-card">
                      {offer.image && <img src={offer.image} alt="" className="club-public-offer-image" />}
                      <h3 className="offer-title">{title}</h3>
                      {desc && <p className="offer-desc">{desc}</p>}
                      <div className="offer-meta">
                        {(offer.discount != null || offer.fixedAmount != null) && (
                          <span className="offer-discount">
                            {offer.discountType === 'fixed' && offer.fixedAmount != null
                              ? `${offer.fixedAmount} ${currency} ${c.discount}`
                              : `${offer.discount}% ${c.discount}`}
                          </span>
                        )}
                        {offer.validUntil && <span className="offer-valid">{c.validUntil} {offer.validUntil}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="club-public-section club-public-about">
          <div className="club-public-section-inner">
            <h2 className="section-heading">{c.aboutClub}</h2>
            <p className="club-public-about-text">
              {tagline || (language === 'en' ? 'Indoor padel courts. King of the Court and Social tournaments. For all levels.' : 'ملاعب بادل داخلية. بطولات ملك الملعب وسوشيال. لجميع المستويات.')}
            </p>
          </div>
        </section>

        <section className="club-public-section club-public-facilities">
          <div className="club-public-section-inner">
            <h2 className="section-heading">{c.facilities}</h2>
            <div className="club-public-courts">
              {(club.courts?.length || 0) > 0 ? (
                (club.courts || []).map(court => (
                  <div key={court.id} className="club-public-court-card">
                    <div className="club-public-court-card-image-wrap">
                      {court.image ? (
                        <img src={court.image} alt="" className="club-public-court-card-image" />
                      ) : (
                        <div className="club-public-court-card-placeholder">
                          <span className="court-placeholder-icon">🏸</span>
                        </div>
                      )}
                      {court.maintenance && <span className="club-public-court-maintenance-badge">{language === 'en' ? 'Maintenance' : 'صيانة'}</span>}
                    </div>
                    <div className="club-public-court-card-body">
                      <span className="court-name">{language === 'ar' && court.nameAr ? court.nameAr : court.name}</span>
                      <span className="court-type">{court.type === 'indoor' ? (language === 'en' ? 'Indoor' : 'داخلي') : (language === 'en' ? 'Outdoor' : 'خارجي')}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="club-public-no-data">{language === 'en' ? 'No courts listed.' : 'لا توجد ملاعب مسجلة.'}</p>
              )}
            </div>
          </div>
        </section>

        <section className="club-public-section club-public-current-tournaments">
          <div className="club-public-section-inner">
            <h2 className="section-heading">{c.currentTournaments}</h2>
            {currentTournaments.length === 0 ? (
              <p className="club-public-no-data">{c.currentTournamentsEmpty}</p>
            ) : (
              <div className="club-public-tournaments-grid">
                {currentTournaments.map((b, i) => (
                  <div key={b.id || i} className="club-public-tournament-card current">
                    <span className="tournament-type">{tournamentTypeName(b.tournamentType)}</span>
                    <span className="tournament-date">{formatDate(b.dateStr)}</span>
                    <span className="tournament-time">{b.startTime} – {b.endTime}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="club-public-section club-public-future-tournaments">
          <div className="club-public-section-inner">
            <h2 className="section-heading">{c.futureTournaments}</h2>
            {futureTournaments.length === 0 ? (
              <p className="club-public-no-data">{c.futureTournamentsEmpty}</p>
            ) : (
              <div className="club-public-future-tournaments-blocks">
                {futureTournamentsUnassigned.length > 0 && (
                  <div className="club-public-tournaments-open-block">
                    <h3 className="club-public-subsection-heading">{c.futureTournamentsOpen}</h3>
                    <p className="club-public-tournaments-open-hint">{c.futureTournamentsOpenHint}</p>
                    <div className="club-public-tournaments-grid club-public-tournaments-grid--open">
                      {futureTournamentsUnassigned.map((b, i) => (
                        <div key={b.id || `open-${i}`} className="club-public-tournament-card club-public-tournament-card--open">
                          <span className="tournament-type">{tournamentTypeName(b.tournamentType)}</span>
                          <span className="tournament-date">{formatDate(b.dateStr)}</span>
                          <span className="tournament-time">{b.startTime} – {b.endTime}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {futureTournamentsWithMembers.length > 0 && (
                  <div className="club-public-tournaments-scheduled-block">
                    <h3 className="club-public-subsection-heading">{c.futureTournamentsWithTeams}</h3>
                    <div className="club-public-future-tournaments-registered-list">
                      {futureTournamentsWithMembers.map((b, i) => {
                        const roster = getTournamentTeamsDetail(club, b)
                        return (
                          <div key={b.id || i} className="club-public-future-tournament-roster-card">
                            <div className="club-public-future-tournament-roster-card__head">
                              <div className="club-public-future-tournament-roster-card__when">
                                <span className="club-public-future-tournament-roster-card__date">{formatDate(b.dateStr)}</span>
                                <span className="club-public-future-tournament-roster-card__time">{b.startTime} – {b.endTime}</span>
                              </div>
                              <span className="club-public-future-tournament-roster-card__type">{tournamentTypeName(b.tournamentType)}</span>
                            </div>
                            <div className="club-public-future-tournament-roster-card__stats" aria-label={language === 'en' ? 'Registration summary' : 'ملخص التسجيل'}>
                              <div className="club-public-tournament-stat-pill">
                                <span className="club-public-tournament-stat-pill__value">{roster.teamCount}</span>
                                <span className="club-public-tournament-stat-pill__label">{c.teamsRegisteredShort}</span>
                              </div>
                              <div className="club-public-tournament-stat-pill club-public-tournament-stat-pill--accent">
                                <span className="club-public-tournament-stat-pill__value">{roster.totalMembers}</span>
                                <span className="club-public-tournament-stat-pill__label">{c.membersTotalShort}</span>
                              </div>
                            </div>
                            <div className="club-public-future-tournament-roster-card__body">
                              <h4 className="club-public-future-tournament-roster-card__subtitle">{c.teamRosterTitle}</h4>
                              <ul className="club-public-future-tournament-team-list">
                                {roster.teams.map((t) => (
                                  <li key={t.id} className="club-public-future-tournament-team-row">
                                    <span className="club-public-future-tournament-team-row__name">{t.name}</span>
                                    <span className="club-public-future-tournament-team-row__count" title={language === 'en' ? 'Registered members' : 'الأعضاء المسجّلون'}>
                                      <strong className="club-public-future-tournament-team-row__num">{t.memberCount}</strong>
                                      {' '}
                                      <span className="club-public-future-tournament-team-row__suffix">{c.membersInTeam}</span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {futureTournamentsUnassigned.length === 0 && futureTournamentsWithMembers.length === 0 && (
                  <p className="club-public-no-data">{c.futureTournamentsEmpty}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {club.storeEnabled && (storeCategories.length > 0 || storeProducts.length > 0) && (
          <section className="club-public-section club-public-store">
            <div className="club-public-section-inner">
              <h2 className="section-heading">
                {language === 'en' ? (club.store?.name || c.storeTitle) : (club.store?.nameAr || club.store?.name || c.storeTitle)}
              </h2>
              {storeProducts.length === 0 ? (
                <p className="club-public-no-data">{c.storeEmpty}</p>
              ) : (
                <div className="club-public-store-by-category">
                  {storeCategories.map(cat => {
                    const prods = productsByCategory[cat.id] || []
                    if (prods.length === 0) return null
                    return (
                      <div key={cat.id} className="store-category-block">
                        <h3 className="store-category-title">
                          {language === 'en' ? cat.name : (cat.nameAr || cat.name)}
                        </h3>
                        <div className="store-products-grid">
                          {prods.map(prod => {
                            const basePrice = parseFloat(prod.price) || 0
                            const salePrice = getProductPrice(prod, basePrice)
                            const hasDiscount = basePrice > 0 && salePrice < basePrice
                            const isOutOfStock = prod.stock != null && prod.stock <= 0
                            return (
                              <div key={prod.id} className={`store-product-card ${hasDiscount ? 'has-sale' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`}>
                                <div className="store-product-image-wrap">
                                  {prod.image ? (
                                    <img src={prod.image} alt="" className="store-product-image" />
                                  ) : (
                                    <div className="store-product-image-placeholder">
                                      <span className="store-product-placeholder-icon">📦</span>
                                    </div>
                                  )}
                                  {hasDiscount && <span className="store-product-sale-badge">{c.sale}</span>}
                                  {prod.stock != null && prod.stock <= 0 && <span className="store-product-stock-badge out">{c.outOfStock}</span>}
                                  {prod.stock != null && prod.stock > 0 && prod.stock <= (club?.store?.minStockAlert ?? 5) && (
                                    <span className="store-product-stock-badge low">{c.inStock}</span>
                                  )}
                                </div>
                                <div className="store-product-body">
                                  <h4 className="store-product-name">{language === 'en' ? prod.name : (prod.nameAr || prod.name)}</h4>
                                  {(prod.description || prod.descriptionAr) && (
                                    <p className="store-product-desc">{language === 'ar' && prod.descriptionAr ? prod.descriptionAr : (prod.description || prod.descriptionAr || '')}</p>
                                  )}
                                  <div className="store-product-price-wrap">
                                    {prod.price != null && prod.price !== '' && (
                                      <>
                                        {hasDiscount && <span className="store-product-price-old">{prod.price} {currency}</span>}
                                        <span className="store-product-price">{salePrice.toFixed(2)} {currency}</span>
                                      </>
                                    )}
                                  </div>
                                  <button type="button" className="store-product-view-btn" disabled={isOutOfStock}>{c.viewProduct}</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {(productsByCategory['_uncategorized'] || []).length > 0 && (
                    <div className="store-category-block">
                      <h3 className="store-category-title">{c.uncategorized}</h3>
                      <div className="store-products-grid">
                        {(productsByCategory['_uncategorized'] || []).map(prod => {
                          const basePrice = parseFloat(prod.price) || 0
                          const salePrice = getProductPrice(prod, basePrice)
                          const hasDiscount = basePrice > 0 && salePrice < basePrice
                          const isOutOfStock = prod.stock != null && prod.stock <= 0
                          return (
                            <div key={prod.id} className={`store-product-card ${hasDiscount ? 'has-sale' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`}>
                              <div className="store-product-image-wrap">
                                {prod.image ? (
                                  <img src={prod.image} alt="" className="store-product-image" />
                                ) : (
                                  <div className="store-product-image-placeholder">
                                    <span className="store-product-placeholder-icon">📦</span>
                                  </div>
                                )}
                                {hasDiscount && <span className="store-product-sale-badge">{c.sale}</span>}
                                {prod.stock != null && prod.stock <= 0 && <span className="store-product-stock-badge out">{c.outOfStock}</span>}
                              </div>
                              <div className="store-product-body">
                                <h4 className="store-product-name">{language === 'en' ? prod.name : (prod.nameAr || prod.name)}</h4>
                                {(prod.description || prod.descriptionAr) && (
                                  <p className="store-product-desc">{language === 'ar' && prod.descriptionAr ? prod.descriptionAr : (prod.description || prod.descriptionAr || '')}</p>
                                )}
                                <div className="store-product-price-wrap">
                                  {prod.price != null && prod.price !== '' && (
                                    <>
                                      {hasDiscount && <span className="store-product-price-old">{prod.price} {currency}</span>}
                                      <span className="store-product-price">{salePrice.toFixed(2)} {currency}</span>
                                    </>
                                  )}
                                </div>
                                <button type="button" className="store-product-view-btn" disabled={isOutOfStock}>{c.viewProduct}</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="club-public-section club-public-contact">
          <div className="club-public-section-inner">
            <h2 className="section-heading">{c.contact}</h2>
            <div className="club-public-contact-grid">
              {address && (
                <div className="contact-item">
                  <span className="contact-label">{c.address}</span>
                  <span className="contact-value">{address}</span>
                </div>
              )}
              {club.phone && (
                <div className="contact-item">
                  <span className="contact-label">{c.phone}</span>
                  <a href={`tel:${club.phone}`} className="contact-value">{club.phone}</a>
                </div>
              )}
              {club.email && (
                <div className="contact-item">
                  <span className="contact-label">{c.email}</span>
                  <a href={`mailto:${club.email}`} className="contact-value">{club.email}</a>
                </div>
              )}
              {club.website && (
                <div className="contact-item">
                  <span className="contact-label">{c.website}</span>
                  <a href={club.website} target="_blank" rel="noopener noreferrer" className="contact-value">{club.website}</a>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="club-public-cta">
          <div className="club-public-cta-inner">
            {joinStatus === 'success' && <p className="club-public-message success">{c.joinSuccess}</p>}
            {joinStatus === 'already' && <p className="club-public-message info">{c.alreadyMember}</p>}
            {joinStatus === 'error' && <p className="club-public-message error">{language === 'en' ? 'Something went wrong. Try again.' : 'حدث خطأ. حاول مرة أخرى.'}</p>}
            {!platformUser && <p className="club-public-register-hint">{c.registerThenJoin}</p>}
            <div className="club-public-cta-buttons">
              {!platformUser && <Link to={`/register?join=${clubId}`} className="btn-register">{c.registerFirst}</Link>}
              <button type="button" className="btn-join-club" onClick={handleJoinClub} disabled={isMember}>
                {isMember ? c.alreadyMember : c.joinClub}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="club-public-footer">
        <Link to="/">{c.backToHome}</Link>
      </footer>
    </div>
  )
}

export default ClubPublicPage
