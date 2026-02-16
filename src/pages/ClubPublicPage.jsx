import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { loadClubs, getClubById, getClubMembersFromStorage, addMemberToClub, addBookingToClub, refreshClubsFromApi, upsertMember } from '../storage/adminStorage'
import { calculateBookingPrice } from '../utils/bookingPricing'
import * as bookingApi from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import CalendarPicker from '../components/CalendarPicker'
import SocialIcon from '../components/SocialIcon'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getClubAdminSession } from '../storage/clubAuth'
import MemberAccountDropdown from '../components/MemberAccountDropdown'
import BookingCountdownCard from '../components/BookingCountdownCard'
import BookingPaymentShare from '../components/BookingPaymentShare'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './ClubPublicPage.css'
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

/** إضافة دقائق إلى وقت "HH:mm" وإرجاع "HH:mm" */
const addMinutesToTime = (timeStr, minutes) => {
  const m = timeToMinutes(timeStr) + (minutes || 0)
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
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

/** استخراج نطاقات محجوزة أو مقفلة لملعب وتاريخ معين (بالدقائق من منتصف الليل) */
const getBlockedRangesForCourtAndDate = (courtNameOrId, dateStr, bookings, activeLocks, excludeLockId = null) => {
  const courtStr = (courtNameOrId || '').toString().trim()
  const ranges = []
  const push = (startTime, endTime) => {
    const startM = timeToMinutes(startTime)
    let endM = timeToMinutes(endTime)
    if (endM <= startM && startTime) endM = startM + 60
    if (endM > startM) ranges.push({ startM, endM })
  }
  ;(bookings || []).forEach(b => {
    if (b.isTournament) return
    if (['cancelled', 'expired'].includes((b.status || '').toString())) return
    const bDate = (b.date || b.startDate || '').toString().split('T')[0]
    if (bDate !== dateStr) return
    const res = (b.resource || b.court || b.courtId || '').toString().trim()
    if (res !== courtStr && res !== (courtNameOrId?.name || courtNameOrId?.id || '').toString().trim()) return
    const start = (b.startTime || b.timeSlot || '').toString().trim()
    let end = (b.endTime || '').toString().trim()
    if (!end && start) end = addMinutesToTime(start, 60)
    push(start, end)
  })
  ;(activeLocks || []).forEach(l => {
    if (excludeLockId && l.id === excludeLockId) return
    const lCourt = (l.court_id || '').toString()
    if (lCourt !== courtStr && lCourt !== (courtNameOrId?.name || courtNameOrId?.id || '').toString().trim()) return
    const lDate = (l.booking_date || '').toString().split('T')[0]
    if (lDate !== dateStr) return
    push(l.start_time || '', l.end_time || '')
  })
  return ranges
}

/** مدد متاحة (مضاعفات 30) من minDur حتى نهاية العمل، ولا تتداخل مع نطاقات محجوزة/مقفلة */
const getAvailableDurations = (minDur, startTime, closingTime, blockedRanges, maxDurationCap = 180) => {
  const startM = timeToMinutes(startTime)
  const closingM = timeToMinutes(closingTime || '23:00')
  const maxDur = Math.min(maxDurationCap, Math.max(0, closingM - startM))
  const out = []
  for (let d = minDur; d <= maxDur; d += 30) {
    if (!overlapsAny(startM, startM + d, blockedRanges)) out.push(d)
  }
  return out
}

const getTimeSlotsForClub = (club) => {
  const open = club?.settings?.openingTime
  const close = club?.settings?.closingTime
  const slots = []
  if (!open || !close) {
    for (let hour = 0; hour < 24; hour++) {
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
  const [courtGridDate, setCourtGridDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [bookingModal, setBookingModal] = useState(null)
  const [paymentShares, setPaymentShares] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('at_club') // 'at_club' | 'split'
  const [bookingSuccessId, setBookingSuccessId] = useState(null) // show success and link to my-bookings
  const bookingsSectionRef = React.useRef(null)
  const [activeLock, setActiveLock] = useState(null)
  const [activeLocks, setActiveLocks] = useState([])
  const [lockError, setLockError] = useState(null)
  const [loadRetrying, setLoadRetrying] = useState(false)

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
    bookingApi.getBookingLocks(clubId, courtGridDate).then(setActiveLocks).catch(() => setActiveLocks([]))
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

  useEffect(() => {
    if (!bookingSuccessId) return
    const t = setTimeout(() => setBookingSuccessId(null), 8000)
    const scrollT = setTimeout(() => bookingsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 400)
    return () => { clearTimeout(t); clearTimeout(scrollT) }
  }, [bookingSuccessId])

  const bookings = useMemo(() => {
    const list = (club?.bookings && Array.isArray(club.bookings)) ? club.bookings : getClubBookings(clubId)
    return list || []
  }, [clubId, club?.id, club?.bookings])
  const today = useMemo(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  }, [])

  const courtBookings = useMemo(() =>
    bookings
      .filter(b => !b.isTournament && (b.date || b.startDate))
      .filter(b => !['cancelled', 'expired'].includes((b.status || '').toString()))
      .map(b => ({ ...b, dateStr: (b.date || b.startDate || '').toString().split('T')[0] }))
      .filter(b => b.dateStr >= today)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr) || (a.startTime || '').localeCompare(b.startTime || ''))
      .slice(0, 30),
    [bookings, today]
  )

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

  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingDuration, setBookingDuration] = useState(60)
  const durationOptions = useMemo(() => {
    const min = club?.settings?.bookingDuration ?? 60
    const durationPrices = Array.isArray(club?.settings?.bookingPrices?.durationPrices) ? club.settings.bookingPrices.durationPrices : []
    const fromSettings = durationPrices
      .filter(d => (d.durationMinutes || 0) >= min)
      .map(d => ({ durationMinutes: d.durationMinutes || 60, price: parseFloat(d.price) || 0 }))
      .sort((a, b) => a.durationMinutes - b.durationMinutes)
    if (!bookingModal?.court || !bookingModal?.dateStr || !bookingModal?.startTime) {
      return fromSettings.length > 0 ? fromSettings : [{ durationMinutes: min, price: 0 }]
    }
    const court = bookingModal.court
    const courtId = (court?.name || court?.id || '').toString()
    const blocked = getBlockedRangesForCourtAndDate(courtId, bookingModal.dateStr, bookings, activeLocks, activeLock?.lockId || null)
    const closing = club?.settings?.closingTime || '23:00'
    const availableSet = new Set(getAvailableDurations(min, bookingModal.startTime, closing, blocked))
    const filtered = fromSettings.filter(d => availableSet.has(d.durationMinutes))
    return filtered.length > 0 ? filtered : (fromSettings.length > 0 ? fromSettings : [{ durationMinutes: min, price: 0 }])
  }, [club?.settings?.bookingDuration, club?.settings?.closingTime, club?.settings?.bookingPrices, bookingModal, bookings, activeLocks, activeLock?.lockId])

  useEffect(() => {
    if (bookingModal && durationOptions.length > 0) {
      const first = durationOptions[0].durationMinutes || 60
      setBookingDuration(prev => {
        const valid = durationOptions.some(d => d.durationMinutes === prev)
        return valid ? prev : first
      })
    }
  }, [bookingModal?.dateStr, bookingModal?.startTime, durationOptions])

  const isMember = club && platformUser && (
    platformUser.clubIds?.includes(club.id) ||
    platformUser.clubId === club.id ||
    (Array.isArray(clubMembersList) && clubMembersList.some(m => String(m.id) === String(platformUser.id)))
  )

  const handleSlotClick = useCallback(async (court, dateStr, startTime) => {
    if (!platformUser || !isMember) return
    if (isSlotInPast(dateStr, startTime)) {
      setLockError(language === 'en' ? 'Cannot book a date or time in the past. Please select a future slot.' : 'لا يمكن حجز تاريخ أو وقت سابق. يرجى اختيار وقت قادم.')
      return
    }
    setLockError(null)
    const minDur = club?.settings?.bookingDuration ?? 60
    const durationPrices = Array.isArray(club?.settings?.bookingPrices?.durationPrices) ? club.settings.bookingPrices.durationPrices : []
    const configured = (durationPrices || []).filter(d => (d.durationMinutes || 0) >= minDur).map(d => d.durationMinutes || 0)
    const courtId = (court?.name || court?.id || '').toString()
    const blocked = getBlockedRangesForCourtAndDate(courtId, dateStr, bookings, activeLocks)
    const closing = club?.settings?.closingTime || '23:00'
    const available = getAvailableDurations(minDur, startTime, closing, blocked)
    const availableSet = new Set(available)
    const allowed = configured.filter(d => availableSet.has(d))
    if (allowed.length === 0) {
      setLockError(language === 'en' ? 'No duration available; slot conflicts with another booking.' : 'لا توجد مدة متاحة؛ الوقت يتعارض مع حجز آخر.')
      return
    }
    const lockDur = Math.max(...allowed)
    const endTime = addMinutesToTime(startTime, lockDur)
    const lockMinutes = club?.settings?.lockMinutes ?? 10
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
        setLockError(language === 'en' ? 'Could not reserve slot. Please try again.' : 'تعذر حجز الوقت. حاول مجدداً.')
      }
    }
  }, [clubId, platformUser, isMember, club?.settings?.bookingDuration, club?.settings?.bookingPrices?.durationPrices, club?.settings?.closingTime, club?.settings?.lockMinutes, language, refreshClub, bookings, activeLocks])

  const handleCloseBookingModal = useCallback(() => {
    if (activeLock?.lockId) {
      bookingApi.releaseBookingLock(activeLock.lockId, clubId, bookingModal?.dateStr).catch(() => {})
      setActiveLock(null)
    }
    setBookingModal(null)
    setPaymentShares([])
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
      bookNow: 'Book now',
      bookingPrice: 'Price',
      confirmBooking: 'Confirm booking',
      bookingSuccess: 'Booking confirmed!',
      paymentMethod: 'Payment',
      payAtClub: 'Pay at club (cash or card)',
      splitPayment: 'Split payment with others',
      viewMyBookings: 'View my bookings',
      loginToBook: 'Login to book courts',
      courtPrices: 'Court booking prices',
      duration: 'Duration',
      price: 'Price',
      joinPromptTitle: 'You\'re one step away!',
      joinPromptText: 'Join this club now to book courts, participate in tournaments, and enjoy member benefits.',
      joinPreviouslyMemberHint: 'Previously a member? Refresh the page or ask the club to re-add you.',
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
      bookNow: 'احجز الآن',
      bookingPrice: 'السعر',
      confirmBooking: 'تأكيد الحجز',
      bookingSuccess: 'تم تأكيد الحجز!',
      paymentMethod: 'الدفع',
      payAtClub: 'الدفع في النادي (كاش أو كارد)',
      splitPayment: 'تقسيم المبلغ مع آخرين',
      viewMyBookings: 'عرض حجوزاتي',
      loginToBook: 'سجّل الدخول لحجز الملاعب',
      courtPrices: 'أسعار حجوزات الملاعب',
      duration: 'المدة',
      price: 'السعر',
      joinPromptTitle: 'أنت على بُعد خطوة واحدة!',
      joinPromptText: 'انضم للنادي الآن لحجز الملاعب والمشاركة في البطولات والاستفادة من مزايا العضوية.',
      joinPreviouslyMemberHint: 'كنت عضواً سابقاً؟ حدّث الصفحة أو اطلب من إدارة النادي إعادة ربط العضوية.',
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
    const [h, m] = (bookingModal.startTime || '00:00').split(':').map(Number)
    const endM = (h || 0) * 60 + (m || 0) + dur
    const endTime = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
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
      const payAtClub = paymentMethod === 'at_club'
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
        paymentMethod: payAtClub ? 'at_club' : undefined,
        paymentShares: payAtClub ? undefined : (paymentShares.length > 0 ? paymentShares : undefined),
        idempotencyKey
      })
      const bookingId = res?.bookingId
      setActiveLock(null)
      setBookingSuccessId(bookingId || true)
      setBookingModal(null)
      setPaymentShares([])
      setPaymentMethod('at_club')
      setClub(prev => {
        if (!prev || prev.id !== clubId) return prev
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
          paidAmount: priceResult.price
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
          <Link to="/my-bookings" className="club-public-booking-success-link" onClick={() => setBookingSuccessId(null)}>
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
                className="club-public-member-account"
              />
            ) : (
              <div className="club-public-auth-links">
                <Link to={`/register?join=${clubId}`} className="club-public-register-link">{c.registerMembers}</Link>
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

      {club.banner ? (
        <section className="club-public-banner club-public-banner-with-hero">
          <img src={club.banner} alt="" className="club-public-banner-image" />
          {club.logo && (
            <div className="club-public-banner-logo-wrap">
              <img src={club.logo} alt="" className="club-public-banner-logo" />
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
            {club.logo && <img src={club.logo} alt="" className="club-public-logo" />}
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

        <section className="club-public-section club-public-court-booking">
          <div className="club-public-section-inner">
            <div className="club-public-court-booking-header">
              <label className="club-public-court-booking-date-label">{c.selectDate}</label>
              {isMember && (
                <Link to="/my-bookings" className="club-public-my-bookings-link">
                  📅 {language === 'en' ? 'My Bookings' : 'حجوزاتي'}
                </Link>
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
              const timeSlots = getTimeSlotsForClub(club)
              return (
                <div className="club-public-court-booking-wrap" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <div
                    className="club-public-court-grid club-public-court-grid-times-horizontal"
                    style={{
                      gridTemplateColumns: `80px repeat(${timeSlots.length}, minmax(70px, 1fr))`,
                      gridTemplateRows: `44px repeat(${courts.length}, 36px)`,
                      minWidth: `${80 + timeSlots.length * 70}px`
                    }}
                  >
                    <div className="club-public-court-grid-corner" />
                    {timeSlots.map(t => (
                      <div key={t} className="club-public-court-grid-time-header">{t}</div>
                    ))}
                    {courts.map(court => (
                      <React.Fragment key={court.id}>
                        <div className="club-public-court-grid-court-name">
                          {language === 'ar' && court.nameAr ? court.nameAr : court.name}
                        </div>
                        {timeSlots.map(timeSlot => {
                          const courtName = (court.name || '').toString().trim()
                          const courtIdForMatch = (court.id || court.name || '').toString()
                          const dateStr = courtGridDate
                          const isBooked = bookings.some(b => {
                            if (b.isTournament) return false
                            const status = (b.status || '').toString()
                            if (['cancelled', 'expired'].includes(status)) return false
                            const bDate = (b.date || b.startDate || '').toString().split('T')[0]
                            if (bDate !== dateStr) return false
                            const res = (b.resource || b.court || b.courtId || '').toString().trim()
                            if (res !== courtName && res !== courtIdForMatch) return false
                            const start = (b.startTime || b.timeSlot || '').toString().trim()
                            let end = (b.endTime || '').toString().trim()
                            if (!end && start) {
                              const [h, m] = start.split(':').map(Number)
                              const endM = (h || 0) * 60 + (m || 0) + (club?.settings?.bookingDuration || 60)
                              end = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
                            }
                            return isTimeSlotCoveredByBooking(timeSlot, start, end || start)
                          })
                          const isLocked = activeLocks.some(l => {
                            const lCourt = (l.court_id || '').toString()
                            if (lCourt !== courtName && lCourt !== courtIdForMatch) return false
                            const lDate = (l.booking_date || '').toString().split('T')[0]
                            if (lDate !== dateStr) return false
                            return isTimeSlotCoveredByBooking(timeSlot, l.start_time || '', l.end_time || '')
                          })
                          const isPast = isSlotInPast(dateStr, timeSlot)
                          const canBook = !isBooked && !isLocked && !isPast && isMember && platformUser
                          const cellStatus = isLocked ? 'in-progress' : isBooked ? 'booked' : isPast ? 'past' : 'available'
                          return (
                            <div
                              key={timeSlot}
                              role={canBook ? 'button' : undefined}
                              tabIndex={canBook ? 0 : undefined}
                              className={`club-public-court-grid-cell ${cellStatus} ${canBook ? 'clickable' : ''}`}
                              title={isLocked ? (language === 'en' ? 'In progress' : 'قيد الإجراء') : isBooked ? (c.booked || 'Booked') : isPast ? (language === 'en' ? 'Past' : 'منتهي') : canBook ? (c.bookNow || 'Book now') : (c.available || 'Available')}
                              onClick={canBook ? () => handleSlotClick(court, dateStr, timeSlot) : undefined}
                              onKeyDown={canBook ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSlotClick(court, dateStr, timeSlot) } } : undefined}
                            >
                              {''}
                            </div>
                          )
                        })}
                      </React.Fragment>
                    ))}
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
              <div className="club-public-booking-modal-body">
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
                  <strong>{bookingModal.startTime}</strong>
                </p>
                <div className="club-public-booking-modal-row club-public-booking-modal-duration">
                  <label>{c.duration}:</label>
                  <select
                    value={bookingDuration}
                    onChange={e => setBookingDuration(parseInt(e.target.value, 10))}
                    className="club-public-booking-duration-select"
                  >
                    {durationOptions.map(d => (
                      <option key={d.durationMinutes} value={d.durationMinutes}>
                        {d.durationMinutes} {language === 'en' ? 'min' : 'دقيقة'} — {parseFloat(d.price != null ? d.price : 0).toFixed(0)} {currency}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="club-public-booking-modal-price">
                  <span>{c.bookingPrice}:</span>
                  <strong className="club-public-booking-modal-price-value">
                    {calculateBookingPrice(club, bookingModal.dateStr, bookingModal.startTime, bookingDuration).price} {currency}
                  </strong>
                </div>
                <div className="club-public-booking-payment-method">
                  <p className="club-public-booking-payment-method-label">{c.paymentMethod}:</p>
                  <label className="club-public-booking-payment-radio">
                    <input type="radio" name="paymentMethod" checked={paymentMethod === 'at_club'} onChange={() => { setPaymentMethod('at_club'); setPaymentShares([]) }} />
                    <span>{c.payAtClub}</span>
                  </label>
                  <label className="club-public-booking-payment-radio">
                    <input type="radio" name="paymentMethod" checked={paymentMethod === 'split'} onChange={() => setPaymentMethod('split')} />
                    <span>{c.splitPayment}</span>
                  </label>
                </div>
                {paymentMethod === 'split' && (
                  <BookingPaymentShare
                    totalPrice={calculateBookingPrice(club, bookingModal.dateStr, bookingModal.startTime, bookingDuration).price}
                    currency={currency}
                    clubName={language === 'ar' && club?.nameAr ? club.nameAr : club?.name}
                    clubId={clubId}
                    dateStr={bookingModal.dateStr}
                    startTime={bookingModal.startTime}
                    clubMembers={clubMembersList}
                    currentMemberId={platformUser?.id}
                    language={language}
                    value={paymentShares}
                    onChange={setPaymentShares}
                  />
                )}
              </div>
              {activeLock && (
                <p className="club-public-booking-lock-notice">
                  {language === 'en' ? '⏱ Slot reserved. Complete payment within 10 minutes.' : '⏱ الوقت محجوز. أكمل الدفع خلال 10 دقائق.'}
                </p>
              )}
              <div className="club-public-booking-modal-actions">
                <button type="button" className="club-public-booking-modal-cancel" onClick={() => { if (!bookingSubmitting) handleCloseBookingModal() }} disabled={bookingSubmitting}>
                  {language === 'en' ? 'Cancel' : 'إلغاء'}
                </button>
                <button
                  type="button"
                  className="club-public-booking-modal-confirm"
                  onClick={handleConfirmBooking}
                  disabled={bookingSubmitting || (paymentMethod === 'split' && paymentShares?.length > 0 && (paymentShares || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) > calculateBookingPrice(club, bookingModal.dateStr, bookingModal.startTime, bookingDuration).price)}
                >
                  {bookingSubmitting ? (language === 'en' ? 'Booking...' : 'جاري الحجز...') : c.confirmBooking}
                </button>
              </div>
            </div>
          </div>
        )}

        <section ref={bookingsSectionRef} className="club-public-section club-public-upcoming-block">
          <div className="club-public-section-inner">
            {courtBookings.length === 0 ? (
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
              <div className="club-public-table-wrap">
                <table className="club-public-table">
                  <thead>
                    <tr>
                      <th>{c.date}</th>
                      <th>{c.time}</th>
                      <th>{language === 'en' ? 'Type' : 'النوع'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {futureTournaments.map((b, i) => (
                      <tr key={b.id || i}>
                        <td>{formatDate(b.dateStr)}</td>
                        <td>{b.startTime} – {b.endTime}</td>
                        <td>{tournamentTypeName(b.tournamentType)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
