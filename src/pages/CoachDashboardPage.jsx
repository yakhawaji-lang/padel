/**
 * Coach Dashboard - صفحة المدرب
 * تظهر فقط عند تسجيل دخول عضو مدرب في النادي
 * جدول الملاعب بالأوقات مثل الصفحة الرئيسية - الضغط على خلية يضيف/يزيل توفر المدرب
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getClubById, refreshClubsFromApi, updateBookingInClub, getClubMembersFromStorage, getAllMembersFromStorage } from '../storage/adminStorage'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getAppLanguage } from '../storage/languageStorage'
import * as bookingApi from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import MultiDatePicker from '../components/MultiDatePicker'
import { getTimeSlotsForClub, isTimeSlotCoveredByBooking, isSlotInPast, addMinutesToTime, timeToMinutes } from '../utils/coachGridHelpers'
import CountryCodeSelect from '../components/CountryCodeSelect'
import { DEFAULT_COUNTRY, normalizeSearchDigits, getMinDigitsForCountry, normalizeMemberPhone } from '../utils/countryCodes'
import './CoachDashboardPage.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const SLOT_STEP_MIN = 30

function waMeUrlFromDigits(digits) {
  const d = (digits || '').replace(/\D/g, '')
  if (!d) return null
  return `https://wa.me/${d}`
}

function buildTrainerInviteMessage({ language, clubName, dateLabel, startTime, endTime, clubUrl }) {
  if (language === 'ar') {
    return `مرحباً، أدعوك للانضمام إلى حصة تدريبية في ${clubName}.\n📅 ${dateLabel}\n⏰ ${startTime}${endTime ? ` – ${endTime}` : ''}\nيمكنك فتح صفحة النادي وحجز مقعدك من هنا:\n${clubUrl}`
  }
  return `Hello — you're invited to join a training session at ${clubName}.\n📅 ${dateLabel}\n⏰ ${startTime}${endTime ? ` – ${endTime}` : ''}\nOpen the club page to book your spot:\n${clubUrl}`
}

function shiftCalendarDateStr(isoDateStr, deltaDays) {
  const [y, mo, d] = (isoDateStr || '').split('-').map(Number)
  if (!y || !mo || !d) return null
  const dt = new Date(y, mo - 1, d + deltaDays)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const CoachDashboardPage = () => {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [club, setClub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('available')
  const [gridDate, setGridDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [createPrice, setCreatePrice] = useState(150)
  const [createMaxTrainees, setCreateMaxTrainees] = useState(4)
  const [submitting, setSubmitting] = useState(null)
  const [createError, setCreateError] = useState('')
  const [durationModal, setDurationModal] = useState(null) // { court, dateStr, timeSlot, selectedHours }
  const [coachSlotModal, setCoachSlotModal] = useState(null) // { booking, court } — عرض تعديل/حذف
  const [editSlotForm, setEditSlotForm] = useState(null) // { booking, court, pricePerHour, startTime, endTime, maxTrainees }
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY.code)
  const [favNumberInput, setFavNumberInput] = useState('')
  const [favoritesIds, setFavoritesIds] = useState([])
  const [favoritesMemberMap, setFavoritesMemberMap] = useState({})
  const [favoritesError, setFavoritesError] = useState('')
  const [favoritesAddingId, setFavoritesAddingId] = useState(null)
  const [inviteBusyMemberId, setInviteBusyMemberId] = useState(null)
  const [quickInvitePhone, setQuickInvitePhone] = useState('')
  const [favoritesSectionOpen, setFavoritesSectionOpen] = useState(true)
  const [inviteModalFavoritesOpen, setInviteModalFavoritesOpen] = useState(true)

  const favoritesStorageKey = `padel_coach_favorites_open_${clubId}`
  const inviteModalFavStorageKey = `padel_coach_invite_modal_fav_${clubId}`

  useEffect(() => {
    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(favoritesStorageKey) : null
      setFavoritesSectionOpen(v !== '0')
    } catch (_) {
      setFavoritesSectionOpen(true)
    }
  }, [favoritesStorageKey])

  useEffect(() => {
    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(inviteModalFavStorageKey) : null
      setInviteModalFavoritesOpen(v !== '0')
    } catch (_) {
      setInviteModalFavoritesOpen(true)
    }
  }, [inviteModalFavStorageKey])

  const toggleInviteModalFavorites = useCallback(() => {
    setInviteModalFavoritesOpen((prev) => {
      const next = !prev
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(inviteModalFavStorageKey, next ? '1' : '0')
        }
      } catch (_) {}
      return next
    })
  }, [inviteModalFavStorageKey])

  const toggleFavoritesSection = useCallback(() => {
    setFavoritesSectionOpen((prev) => {
      const next = !prev
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(favoritesStorageKey, next ? '1' : '0')
        }
      } catch (_) {}
      return next
    })
  }, [favoritesStorageKey])

  const platformUser = getCurrentPlatformUser()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await refreshClubsFromApi()
      const c = getClubById(clubId)
      setClub(c)
      setLoading(false)
    }
    load()
  }, [clubId])

  const isCoach = useMemo(() => {
    if (!club?.memberCoaches || !platformUser?.id) return false
    return (club.memberCoaches || []).some(mc => String(mc) === String(platformUser.id))
  }, [club?.memberCoaches, platformUser?.id])

  useEffect(() => {
    if (loading || !club) return
    if (!platformUser?.id || !isCoach) {
      navigate(`/clubs/${clubId}`, { replace: true })
    }
  }, [loading, club, platformUser?.id, isCoach, clubId, navigate])

  const loadCoachFavorites = useCallback(async () => {
    if (!platformUser?.id || !clubId || !isCoach) return
    setFavoritesError('')
    try {
      const ids = await bookingApi.getFavoriteMembers(platformUser.id, clubId)
      const idList = Array.isArray(ids) ? ids.map(String) : []
      const fromAll = getAllMembersFromStorage() || []
      const fromClub = getClubMembersFromStorage(clubId) || []
      const byId = {}
      for (const m of [...fromClub, ...fromAll]) {
        if (m?.id != null) byId[String(m.id)] = m
      }
      setFavoritesIds(idList)
      setFavoritesMemberMap(prev => ({ ...prev, ...byId }))
    } catch (err) {
      setFavoritesError(err?.message || '')
      setFavoritesIds([])
    }
  }, [platformUser?.id, clubId, isCoach])

  useEffect(() => {
    loadCoachFavorites()
  }, [loadCoachFavorites])

  useEffect(() => {
    const onSync = () => loadCoachFavorites()
    window.addEventListener('clubs-synced', onSync)
    return () => window.removeEventListener('clubs-synced', onSync)
  }, [loadCoachFavorites])

  const bookings = useMemo(() => {
    const list = club?.bookings || []
    return list.filter(b => {
      const d = b.data && typeof b.data === 'object' ? b.data : {}
      const type = b.type || d.type
      const coachId = b.coachId || d.coachId || b.memberId
      return type === 'training' && String(coachId || '') === String(platformUser?.id || '')
    })
  }, [club?.bookings, platformUser?.id])

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const upcoming = useMemo(() => {
    return bookings.filter(b => {
      const d = (b.date || b.startDate || '').toString().split('T')[0]
      if (d < todayStr) return false
      const st = b.startTime || b.timeSlot || ''
      if (d === todayStr && st) {
        const [h, m] = st.toString().split(':').map(Number)
        const slotM = (h || 0) * 60 + (m || 0)
        const nowM = now.getHours() * 60 + now.getMinutes()
        if (slotM <= nowM) return false
      }
      return true
    }).sort((a, b) => {
      const da = (a.date || a.startDate || '').toString()
      const db = (b.date || b.startDate || '').toString()
      if (da !== db) return da.localeCompare(db)
      return (a.startTime || '').localeCompare(b.startTime || '')
    })
  }, [bookings, todayStr, now])

  const past = useMemo(() => {
    return bookings.filter(b => {
      const d = (b.date || b.startDate || '').toString().split('T')[0]
      if (d > todayStr) return false
      const st = b.startTime || b.timeSlot || ''
      if (d === todayStr && st) {
        const [h, m] = st.toString().split(':').map(Number)
        const slotM = (h || 0) * 60 + (m || 0)
        const nowM = now.getHours() * 60 + now.getMinutes()
        if (slotM > nowM) return false
      }
      return true
    }).sort((a, b) => {
      const da = (a.date || a.startDate || '').toString()
      const db = (b.date || b.startDate || '').toString()
      if (da !== db) return db.localeCompare(da)
      return (b.startTime || '').localeCompare(a.startTime || '')
    })
  }, [bookings, todayStr, now])

  /** Slots coach created but not yet booked by anyone (0 trainees) */
  const availableSlots = useMemo(() => {
    return bookings.filter(b => {
      const d = (b.date || b.startDate || '').toString().split('T')[0]
      if (d < todayStr) return false
      const st = b.startTime || b.timeSlot || ''
      if (d === todayStr && st) {
        const [h, m] = st.toString().split(':').map(Number)
        const slotM = (h || 0) * 60 + (m || 0)
        const nowM = now.getHours() * 60 + now.getMinutes()
        if (slotM <= nowM) return false
      }
      const shares = b.paymentShares || []
      const traineeCount = shares.filter(s => String(s.memberId || '') !== String(platformUser?.id)).length
      return traineeCount === 0
    }).sort((a, b) => {
      const da = (a.date || a.startDate || '').toString()
      const db = (b.date || b.startDate || '').toString()
      if (da !== db) return da.localeCompare(db)
      return (a.startTime || '').localeCompare(b.startTime || '')
    })
  }, [bookings, todayStr, now, platformUser?.id])

  const confirmedDates = useMemo(() => {
    const seen = new Set()
    return upcoming.filter(b => {
      const d = (b.date || b.startDate || '').toString().split('T')[0]
      if (seen.has(d)) return false
      seen.add(d)
      return true
    }).map(b => ({
      date: (b.date || b.startDate || '').toString().split('T')[0],
      courtId: b.courtId || b.resource,
      count: upcoming.filter(x => (x.date || x.startDate || '').toString().split('T')[0] === (b.date || b.startDate || '').toString().split('T')[0]).length
    }))
  }, [upcoming])

  const stats = useMemo(() => {
    const total = bookings.length
    const availableCount = availableSlots.length
    const upcomingCount = upcoming.length
    const pastCount = past.length
    const totalRevenue = bookings.reduce((s, b) => s + (parseFloat(b.paidAmount) || 0), 0)
    return { total, availableCount, upcomingCount, pastCount, totalRevenue }
  }, [bookings, availableSlots, upcoming, past])

  const datesWithCoachSlots = useMemo(() => {
    const set = new Set()
    ;(club?.bookings || []).forEach(b => {
      const d = b.data && typeof b.data === 'object' ? b.data : {}
      const type = b.type || d.type
      const coachId = b.coachId || d.coachId || b.memberId
      if (type === 'training' && String(coachId || '') === String(platformUser?.id || '')) {
        const dateStr = (b.date || b.startDate || '').toString().split('T')[0]
        if (dateStr && dateStr >= todayStr) set.add(dateStr)
      }
    })
    return Array.from(set)
  }, [club?.bookings, platformUser?.id, todayStr])

  const handleCoachSlotDelete = useCallback(async (bookingId) => {
    if (submitting) return
    setCreateError('')
    setCoachSlotModal(null)
    setSubmitting(`cancel-${bookingId}`)
    try {
      await bookingApi.cancelBooking(bookingId)
      await refreshClubsFromApi()
      setClub(getClubById(clubId))
    } catch (err) {
      setCreateError(err?.message || t('Failed to cancel slot', 'فشل في إلغاء الحجز', language))
    } finally {
      setSubmitting(null)
    }
  }, [clubId, submitting])

  const handleCoachSlotEditSave = useCallback(async () => {
    if (!editSlotForm?.booking?.id || submitting) return
    const startM = timeToMinutes(editSlotForm.startTime)
    const endM = timeToMinutes(editSlotForm.endTime)
    if (endM <= startM) {
      setCreateError(t('End time must be after start time', 'وقت النهاية يجب أن يكون بعد وقت البداية', language))
      return
    }
    setCreateError('')
    setSubmitting(`edit-${editSlotForm.booking.id}`)
    try {
      const durationHours = (endM - startM) / 60
      const totalAmount = Math.round((parseFloat(editSlotForm.pricePerHour) || 0) * Math.max(0.5, durationHours) * 100) / 100
      const data = editSlotForm.booking.data && typeof editSlotForm.booking.data === 'object'
        ? { ...editSlotForm.booking.data }
        : {}
      data.maxTrainees = editSlotForm.maxTrainees
      data.pricePerHour = parseFloat(editSlotForm.pricePerHour) || 0
      await updateBookingInClub(clubId, editSlotForm.booking.id, {
        startTime: editSlotForm.startTime,
        endTime: editSlotForm.endTime,
        timeSlot: editSlotForm.startTime,
        totalAmount,
        data
      })
      await refreshClubsFromApi()
      setClub(getClubById(clubId))
      setEditSlotForm(null)
    } catch (err) {
      setCreateError(err?.message || t('Failed to update slot', 'فشل في تحديث الحجز', language))
    } finally {
      setSubmitting(null)
    }
  }, [clubId, editSlotForm, submitting, language])

  const handleGridCellClick = useCallback((court, dateStr, timeSlot, isCoachSlot, bookedItem) => {
    if (submitting) return
    setCreateError('')
    if (isCoachSlot && bookedItem) {
      setCoachSlotModal({ booking: bookedItem, court })
      return
    }
    if (!isCoachSlot) {
      setDurationModal({ court, dateStr, timeSlot, selectedHours: 1 })
    }
  }, [submitting])

  const handleDurationConfirm = useCallback(async () => {
    if (!durationModal?.court || submitting) return
    const { court, dateStr, timeSlot, selectedHours } = durationModal
    const hours = Math.min(4, Math.max(1, parseInt(selectedHours, 10) || 1))
    const endTime = addMinutesToTime(timeSlot, hours * 60)
    setDurationModal(null)
    setCreateError('')
    setSubmitting(`${court.id}-${timeSlot}`)
    try {
      await bookingApi.createCoachTrainingSlots({
        clubId,
        courtId: court.id,
        dates: [dateStr],
        startTime: timeSlot,
        endTime,
        pricePerHour: createPrice,
        maxTrainees: createMaxTrainees,
        coachId: platformUser?.id
      })
      await refreshClubsFromApi()
      setClub(getClubById(clubId))
    } catch (err) {
      setCreateError(err?.message || t('Failed to create slot', 'فشل في إنشاء الحجز', language))
    } finally {
      setSubmitting(null)
    }
  }, [durationModal, submitting, clubId, createPrice, createMaxTrainees, platformUser?.id, language])

  const courtName = (id) => {
    const c = club?.courts?.find(x => x.id === id || x.name === id)
    return c ? (language === 'ar' ? c.nameAr || c.name : c.name) : id
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d + 'T12:00:00').toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const clubPublicPath = (() => {
    const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return origin ? `${origin}${basePath}/clubs/${clubId}` : `${basePath}/clubs/${clubId}`
  })()

  /** Register invite in DB (member sees in My bookings) then open WhatsApp — works for any coach training booking */
  const sendTrainingInviteWhatsApp = useCallback(async (booking, inviteeMemberId, phoneDigits) => {
    if (!booking?.id || !platformUser?.id) return
    const b = booking
    const dateStr = (b.date || b.startDate || '').toString().split('T')[0]
    const startT = (b.startTime || b.timeSlot || '').toString()
    const endT = (b.endTime || '').toString()
    const clubName = language === 'ar' ? (club?.nameAr || club?.name || '') : (club?.name || club?.nameAr || '')
    const dateLabel = formatDate(dateStr)
    const msg = buildTrainerInviteMessage({
      language,
      clubName,
      dateLabel,
      startTime: startT,
      endTime: endT,
      clubUrl: clubPublicPath
    })
    setInviteBusyMemberId(inviteeMemberId)
    setCreateError('')
    try {
      await bookingApi.recordCoachTrainingInvites({
        clubId,
        bookingId: b.id,
        coachId: platformUser.id,
        memberIds: [inviteeMemberId]
      })
    } catch (err) {
      setCreateError(err?.message || t('Could not record invite', 'تعذّر تسجيل الدعوة', language))
      setInviteBusyMemberId(null)
      return
    }
    const wa = waMeUrlFromDigits(phoneDigits)
    if (wa) {
      const url = `${wa}?text=${encodeURIComponent(msg)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    setInviteBusyMemberId(null)
  }, [platformUser?.id, clubId, club, language, clubPublicPath, formatDate])

  const openTrainingInviteModal = useCallback((booking, courtResolved) => {
    setQuickInvitePhone('')
    setCoachSlotModal({ booking, court: courtResolved })
  }, [])

  const currency = club?.settings?.currency || 'SAR'
  const splitPayDeadlineMins = club?.settings?.splitPaymentDeadlineMinutes ?? 30

  if (loading || !club) {
    return (
      <div className="coach-dashboard-page">
        <div className="coach-dashboard-loading">
          <div className="coach-dashboard-spinner" />
          <p>{t('Loading...', 'جاري التحميل...', language)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="coach-dashboard-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="coach-dashboard-header">
        <div className="coach-dashboard-header-inner">
          <Link to={`/clubs/${clubId}`} className="coach-dashboard-back" aria-label={t('Back to club', 'العودة للنادي', language)}>
            <span aria-hidden>←</span>
            <span>{t('Club', 'النادي', language)}</span>
          </Link>
          <h1 className="coach-dashboard-title">
            <span className="coach-dashboard-icon">🏸</span>
            {t('Coach Dashboard', 'لوحة المدرب', language)} — {language === 'ar' ? club.nameAr || club.name : club.name}
          </h1>
          <button
            type="button"
            className="coach-dashboard-lang"
            onClick={() => setLanguage(l => l === 'en' ? 'ar' : 'en')}
            title={language === 'en' ? 'العربية' : 'English'}
          >
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} />
          </button>
        </div>
      </header>

      <main className="coach-dashboard-main">
        <section className="coach-dashboard-create">
          <header className="coach-panel-header">
            <div className="coach-panel-title-block">
              <h2 className="coach-panel-title">{t('Set your availability', 'حدد أوقات تواجدك', language)}</h2>
              <p className="coach-panel-subtitle">{t('Pick a date, tap an empty cell, choose duration (1–4 hours), then confirm. Tap your session block to edit, delete, or invite trainees via WhatsApp.', 'اختر التاريخ واضغط خلية فارغة، ثم اختر المدة من 1 إلى 4 ساعات. اضغط على الحصة للتعديل أو الحذف أو دعوة المتدربين عبر واتساب.', language)}</p>
            </div>
          </header>

          <div className="coach-stats-grid" role="list">
            <div className="coach-stat-card" role="listitem">
              <span className="coach-stat-card-value">{stats.availableCount}</span>
              <span className="coach-stat-card-label">{t('Available', 'متاحة', language)}</span>
            </div>
            <div className="coach-stat-card coach-stat-card--booked" role="listitem">
              <span className="coach-stat-card-value">{stats.upcomingCount}</span>
              <span className="coach-stat-card-label">{t('Booked', 'محجوزة', language)}</span>
            </div>
            <div className="coach-stat-card coach-stat-card--past" role="listitem">
              <span className="coach-stat-card-value">{stats.pastCount}</span>
              <span className="coach-stat-card-label">{t('Past', 'سابقة', language)}</span>
            </div>
            <div className="coach-stat-card coach-stat-card--rev" role="listitem">
              <span className="coach-stat-card-value">{stats.totalRevenue} <span className="coach-stat-card-currency">{currency}</span></span>
              <span className="coach-stat-card-label">{t('Recorded revenue', 'إيراد مسجل', language)}</span>
            </div>
          </div>

          <div className="coach-controls-panel">
            <div className="coach-controls-section coach-controls-section--calendar">
              <h3 className="coach-controls-heading">{t('Date', 'التاريخ', language)}</h3>
              <MultiDatePicker
                viewingDate={gridDate}
                onDateClick={setGridDate}
                highlightedDates={datesWithCoachSlots}
                minDate={todayStr}
                language={language}
              />
            </div>
            <div className="coach-controls-section coach-controls-section--session">
              <h3 className="coach-controls-heading">{t('New session defaults', 'إعدادات الجلسة الجديدة', language)}</h3>
              <div className="coach-field-grid">
                <div className="coach-field">
                  <label htmlFor="coach-price-hr">{t('Price per hour', 'السعر للساعة', language)}</label>
                  <div className="coach-field-input-wrap">
                    <input id="coach-price-hr" type="number" min={1} value={createPrice} onChange={e => setCreatePrice(Number(e.target.value) || 0)} />
                    <span className="coach-field-suffix">{currency}</span>
                  </div>
                </div>
                <div className="coach-field">
                  <label htmlFor="coach-max-trainees">{t('Max trainees', 'الحد الأقصى للمتدربين', language)}</label>
                  <select id="coach-max-trainees" value={createMaxTrainees} onChange={e => setCreateMaxTrainees(Number(e.target.value))}>
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="coach-session-policy" aria-label={t('Split payment deadline (club)', 'مهلة دفع التقسيم (النادي)', language)}>
                <p className="coach-session-policy-hint">{t('This deadline is set by the club.', 'هذه المهلة يحددها النادي.', language)}</p>
                <dl className="coach-session-policy-list">
                  <div className="coach-session-policy-row">
                    <dt>{t('Split payment deadline', 'مهلة دفع التقسيم', language)}</dt>
                    <dd>{splitPayDeadlineMins} {t('min', 'دقيقة', language)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <section
            className={`coach-favorites-card coach-favorites-panel ${favoritesSectionOpen ? 'is-open' : 'is-collapsed'}`}
            aria-label={t('Favorite members (invites)', 'أعضاء مفضلون (للدعوات)', language)}
          >
            <header className="coach-favorites-card-header">
              <div className="coach-favorites-card-heading">
                <span className="coach-favorites-card-icon" aria-hidden>★</span>
                <div className="coach-favorites-card-titles">
                  <h3 className="coach-favorites-card-title">
                    {t('Favorite members (invites)', 'أعضاء مفضلون (للدعوات)', language)}
                  </h3>
                  <p className="coach-favorites-card-subtitle">
                    {t('For quick WhatsApp invites from your sessions.', 'للدعوة السريعة عبر واتساب من جلساتك.', language)}
                  </p>
                </div>
                {favoritesIds.length > 0 && (
                  <span className="coach-favorites-card-badge">{favoritesIds.length}</span>
                )}
              </div>
              <button
                type="button"
                className={`coach-favorites-visibility-btn ${favoritesSectionOpen ? 'is-expanded' : ''}`}
                onClick={toggleFavoritesSection}
                aria-expanded={favoritesSectionOpen}
                aria-controls="coach-favorites-panel-content"
              >
                <span className="coach-favorites-visibility-label">
                  {favoritesSectionOpen
                    ? t('Hide favorites', 'إخفاء المفضلة', language)
                    : t('Show favorites', 'إظهار المفضلة', language)}
                </span>
                <span className="coach-favorites-switch" aria-hidden>
                  <span className="coach-favorites-switch-thumb" />
                </span>
              </button>
            </header>
            <div
              id="coach-favorites-panel-content"
              className="coach-favorites-panel-body"
              aria-hidden={!favoritesSectionOpen}
            >
              <div className="coach-favorites-panel-body-inner">
            <div className="coach-favorites-inner-card">
            <p className="coach-favorites-hint">{t('Search by full mobile number to find club members and add them to your favorites.', 'ابحث برقم الجوال كاملاً للعثور على أعضاء النادي وإضافتهم للمفضلة.', language)}</p>
            {favoritesError && <p className="coach-favorites-api-error" role="alert">{favoritesError}</p>}
            <div className="coach-favorites-phone-row">
              <CountryCodeSelect value={countryCode} onChange={setCountryCode} language={language} className="coach-favorites-country-select" />
              <div className="coach-favorites-phone-field">
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  className="coach-favorites-number-input"
                  placeholder={language === 'en' ? 'Mobile number' : 'رقم الجوال'}
                  value={favNumberInput}
                  onChange={e => setFavNumberInput(e.target.value)}
                />
              </div>
            </div>
            {(() => {
              const otherMembers = (getClubMembersFromStorage(clubId) || []).filter(m => String(m?.id) !== String(platformUser?.id))
              const allPlat = getAllMembersFromStorage() || []
              const byId = new Map()
              for (const m of [...otherMembers, ...allPlat]) {
                if (m?.id) byId.set(String(m.id), m)
              }
              const searchDigits = normalizeSearchDigits(countryCode, favNumberInput)
              const minDigits = countryCode.length + getMinDigitsForCountry(countryCode)
              const hasFullPhone = searchDigits.length >= minDigits
              const filtered = hasFullPhone
                ? otherMembers.filter(m => {
                    const mPhone = normalizeMemberPhone(m?.mobile || m?.phone || '')
                    return mPhone && (mPhone.includes(searchDigits) || searchDigits.includes(mPhone))
                  })
                : []
              const favoriteIdSet = new Set(favoritesIds.map(String))
              const toggleFav = async (memberId, isFav) => {
                if (!platformUser?.id || !memberId) return
                setFavoritesError('')
                setFavoritesAddingId(memberId)
                try {
                  if (isFav) {
                    await bookingApi.removeFavoriteMember(platformUser.id, clubId, memberId)
                    setFavoritesIds(prev => prev.filter(id => String(id) !== String(memberId)))
                  } else {
                    await bookingApi.addFavoriteMember(platformUser.id, clubId, memberId)
                    setFavoritesIds(prev => [...prev, String(memberId)])
                  }
                } catch (err) {
                  setFavoritesError(err?.message || t('Action failed', 'فشل الإجراء', language))
                } finally {
                  setFavoritesAddingId(null)
                }
              }
              return (
                <>
                  {hasFullPhone && (
                    <div className="coach-favorites-search-results">
                      {filtered.length === 0 ? (
                        <p className="coach-favorites-empty-msg">{t('No members found for this phone number', 'لا توجد نتائج لهذا الرقم', language)}</p>
                      ) : (
                        <ul className="coach-favorites-result-list">
                          {filtered.map(m => {
                            const isFav = favoriteIdSet.has(String(m.id))
                            return (
                              <li key={m.id} className="coach-favorites-result-row">
                                <span className="coach-fav-avatar" aria-hidden>{(m.name || m.email || '?').toString().trim().charAt(0).toUpperCase()}</span>
                                <span className="coach-fav-name">{m.name || m.email || m.id}</span>
                                <button
                                  type="button"
                                  className={`coach-favorites-star-btn ${isFav ? 'is-favorite' : ''}`}
                                  disabled={!!favoritesAddingId}
                                  onClick={() => toggleFav(m.id, isFav)}
                                  title={isFav ? t('Remove from favorites', 'إزالة من المفضلة', language) : t('Add to favorites', 'إضافة للمفضلة', language)}
                                >
                                  {isFav ? '★' : '☆'}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                  <div className="coach-favorites-current">
                    <span className="coach-favorites-current-title">{t('Saved favorites', 'المفضلة المحفوظة', language)}</span>
                    {favoritesIds.length === 0 ? (
                      <p className="coach-favorites-empty-msg">{t('None yet. Search above.', 'لا يوجد بعد. ابحث أعلاه.', language)}</p>
                    ) : (
                      <ul className="coach-favorites-chips">
                        {favoritesIds.map(fid => {
                          const m = favoritesMemberMap[fid] || byId.get(fid)
                          return (
                            <li key={fid} className="coach-favorites-chip">
                              <span className="coach-favorites-chip-avatar" aria-hidden>{(m ? (m.name || m.email || '?') : '?').toString().trim().charAt(0).toUpperCase()}</span>
                              <span className="coach-favorites-chip-label">{m ? (m.name || m.email || fid) : fid}</span>
                              <button
                                type="button"
                                className="coach-favorites-chip-remove"
                                disabled={!!favoritesAddingId}
                                onClick={() => toggleFav(fid, true)}
                                aria-label={t('Remove', 'إزالة', language)}
                              >×</button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )
            })()}
            </div>
              </div>
            </div>
          </section>

          {createError && <p className="coach-create-error">{createError}</p>}

          <div className="coach-schedule-heading">
            <h3 className="coach-schedule-title">{t('Courts schedule', 'جدول الملاعب', language)}</h3>
            <p className="coach-schedule-hint">{t('Scroll sideways on small screens to see all times.', 'مرّر أفقياً على الشاشات الصغيرة لرؤية كل الأوقات.', language)}</p>
          </div>
          <div className="coach-schedule-booking-wrap" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="coach-schedule-sticky-stack">
              <div className="coach-schedule-date-nav">
                <button
                  type="button"
                  className="coach-schedule-date-nav-btn"
                  onClick={() => {
                    const prev = shiftCalendarDateStr(gridDate, -1)
                    if (prev && prev >= todayStr) setGridDate(prev)
                  }}
                  disabled={gridDate <= todayStr}
                  aria-label={t('Previous day', 'اليوم السابق', language)}
                  title={t('Previous day', 'اليوم السابق', language)}
                >
                  <span className="coach-schedule-date-nav-icon" aria-hidden>‹</span>
                </button>
                <div className="coach-schedule-date-nav-label" aria-live="polite">
                  {formatDate(gridDate)}
                </div>
                <button
                  type="button"
                  className="coach-schedule-date-nav-btn"
                  onClick={() => {
                    const next = shiftCalendarDateStr(gridDate, 1)
                    if (next) setGridDate(next)
                  }}
                  aria-label={t('Next day', 'اليوم التالي', language)}
                  title={t('Next day', 'اليوم التالي', language)}
                >
                  <span className="coach-schedule-date-nav-icon" aria-hidden>›</span>
                </button>
              </div>
            </div>
            <div className="coach-court-grid-scroll">
              <div className="coach-court-grid-wrap">
            {(() => {
              const courts = (club?.courts || []).filter(c => !c.maintenance)
              const timeSlots = getTimeSlotsForClub(club, gridDate)
              if (courts.length === 0) return <p className="coach-no-courts">{t('No courts', 'لا توجد ملاعب', language)}</p>
              return (
                <div
                  className="coach-court-grid club-public-court-grid club-public-court-grid-times-horizontal"
                  style={{
                    gridTemplateColumns: `70px repeat(${timeSlots.length}, minmax(44px, 1fr))`,
                    gridTemplateRows: `28px repeat(${courts.length}, 28px)`,
                    minWidth: `${70 + timeSlots.length * 44}px`
                  }}
                >
                  <div className="club-public-court-grid-corner" />
                  {timeSlots.map(ts => (
                    <div key={ts} className="club-public-court-grid-time-header">{ts}</div>
                  ))}
                  {courts.map(court => (
                    <React.Fragment key={court.id}>
                      <div className="club-public-court-grid-court-name">
                        {language === 'ar' && court.nameAr ? court.nameAr : court.name}
                      </div>
                      {timeSlots.map(timeSlot => {
                        const courtIdForMatch = (court.id || court.name || '').toString()
                        const dateStr = gridDate
                        const bookingsList = club?.bookings || []
                        const bookedItem = bookingsList.find(b => {
                          if (b.isTournament) return false
                          const status = (b.status || '').toString()
                          if (['cancelled', 'expired'].includes(status)) return false
                          const bDate = (b.date || b.startDate || '').toString().split('T')[0]
                          if (bDate !== dateStr) return false
                          const res = (b.resource || b.courtId || b.court || '').toString().trim()
                          if (res !== courtIdForMatch && res !== (court.name || '').toString().trim()) return false
                          const start = (b.startTime || b.timeSlot || '').toString().trim()
                          let end = (b.endTime || '').toString().trim()
                          if (!end && start) end = addMinutesToTime(start, club?.settings?.bookingDuration || 60)
                          return isTimeSlotCoveredByBooking(timeSlot, start, end || start)
                        })
                        const isCoachSlot = bookedItem && (() => {
                          const d = bookedItem.data && typeof bookedItem.data === 'object' ? bookedItem.data : {}
                          const type = bookedItem.type || d.type
                          const coachId = bookedItem.coachId || d.coachId || bookedItem.memberId
                          return type === 'training' && String(coachId || '') === String(platformUser?.id || '')
                        })()
                        const coachIdSelf = String(platformUser?.id || '')
                        const traineeRows = isCoachSlot && bookedItem
                          ? (bookedItem.paymentShares || []).filter(s => String(s.memberId || s.member_id || '') !== coachIdSelf)
                          : []
                        const traineeCount = traineeRows.length
                        const isCoachSlotWithTrainees = isCoachSlot && traineeCount > 0
                        const isOtherBooked = bookedItem && !isCoachSlot
                        const isPast = isSlotInPast(dateStr, timeSlot)
                        const cellKey = `${court.id}-${timeSlot}`
                        const isSubmittingThis = submitting === cellKey || (bookedItem?.id && submitting === `cancel-${bookedItem.id}`)
                        const canAdd = !bookedItem && !isPast
                        const canRemove = isCoachSlot
                        const canClick = (canAdd || canRemove) && !isSubmittingThis
                        const cellStatus = isCoachSlot ? (isCoachSlotWithTrainees ? 'coach-slot coach-slot-with-trainees booked training' : 'coach-slot coach-slot-empty booked training') : isOtherBooked ? 'booked' : isPast ? 'past' : 'available'
                        const slotTitle = isCoachSlot ? (language === 'en' ? 'Edit, delete, or invite trainees' : 'تعديل أو حذف أو دعوة متدربين') : isOtherBooked ? t('Booked', 'محجوز', language) : isPast ? t('Past', 'منتهي', language) : canAdd ? (language === 'en' ? 'Add session (choose duration next)' : 'إضافة حصة (اختر المدة بعدها)') : ''

                        const trainingStart = isCoachSlot && bookedItem ? (bookedItem.startTime || bookedItem.timeSlot || '').toString().trim() : ''
                        const inferDur = isCoachSlot && bookedItem ? (parseInt(bookedItem.durationMinutes, 10) || 60) : 60
                        const trainingEnd = isCoachSlot && bookedItem
                          ? ((bookedItem.endTime || '').toString().trim() || (trainingStart ? addMinutesToTime(trainingStart, inferDur) : ''))
                          : ''
                        const isTrainingBlockStart = isCoachSlot && trainingStart && timeToMinutes(timeSlot) === timeToMinutes(trainingStart)
                        const isTrainingBlockContinuation = isCoachSlot && !isTrainingBlockStart
                        if (isTrainingBlockContinuation) {
                          return null
                        }
                        const trainingSpan = isTrainingBlockStart && trainingEnd
                          ? Math.max(1, Math.round((timeToMinutes(trainingEnd) - timeToMinutes(trainingStart)) / SLOT_STEP_MIN))
                          : 0
                        const traineeLabel = traineeRows.length > 0
                          ? traineeRows.map(s => (s.memberName || s.member_name || s.phone || t('Member', 'عضو', language))).join(language === 'ar' ? '، ' : ', ')
                          : ''

                        const handleCellClick = () => {
                          handleGridCellClick(court, dateStr, timeSlot, isCoachSlot, bookedItem)
                        }
                        return (
                          <div
                            key={timeSlot}
                            role={canClick ? 'button' : undefined}
                            tabIndex={canClick ? 0 : undefined}
                            className={`club-public-court-grid-cell coach-grid-cell ${cellStatus} ${canClick ? 'clickable' : ''} ${isTrainingBlockStart ? 'training-block-merged' : ''}`.trim()}
                            style={trainingSpan > 0 ? { gridColumn: `span ${trainingSpan}` } : undefined}
                            title={slotTitle}
                            onClick={canClick ? handleCellClick : undefined}
                            onKeyDown={canClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellClick() } } : undefined}
                          >
                            {isCoachSlot && isTrainingBlockStart ? (
                              <span className="coach-merged-training-block">
                                <span className="coach-merged-training-time">{trainingStart}{trainingEnd ? `–${trainingEnd}` : ''}</span>
                                {traineeLabel ? (
                                  <span className="coach-merged-training-trainees">{traineeLabel}</span>
                                ) : (
                                  <span className="coach-merged-training-actions-hint">{language === 'en' ? 'Edit · Delete' : 'تعديل · حذف'}</span>
                                )}
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </div>
              )
            })()}
              </div>
            </div>
          </div>
        </section>

        {durationModal && (
          <div className="coach-slot-modal-backdrop" onClick={() => !submitting && setDurationModal(null)}>
            <div className="coach-slot-modal coach-duration-modal" onClick={e => e.stopPropagation()}>
              <h3>{t('Session length', 'مدة الحصة', language)}</h3>
              <p className="coach-duration-modal-info">
                {language === 'ar' && durationModal.court?.nameAr ? durationModal.court.nameAr : durationModal.court?.name} — {formatDate(durationModal.dateStr)} {durationModal.timeSlot}
              </p>
              <p className="coach-duration-modal-hint">{t('How many hours? (1–4)', 'كم عدد الساعات؟ (1–4)', language)}</p>
              <div className="coach-duration-hours-grid" role="group" aria-label={t('Hours', 'الساعات', language)}>
                {[1, 2, 3, 4].map(h => (
                  <button
                    key={h}
                    type="button"
                    className={`coach-duration-hour-btn ${durationModal.selectedHours === h ? 'active' : ''}`}
                    onClick={() => setDurationModal(d => (d ? { ...d, selectedHours: h } : null))}
                  >
                    {h} {language === 'en' ? 'h' : 'س'}
                  </button>
                ))}
              </div>
              <div className="coach-slot-modal-actions">
                <button type="button" className="coach-slot-modal-btn coach-slot-modal-save" onClick={handleDurationConfirm} disabled={!!submitting}>
                  {submitting ? '…' : t('Create', 'إنشاء', language)}
                </button>
                <button type="button" className="coach-slot-modal-btn coach-slot-modal-cancel" onClick={() => setDurationModal(null)} disabled={!!submitting}>
                  {t('Cancel', 'إلغاء', language)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Coach slot edit/delete modal */}
        {coachSlotModal && (() => {
          const b = coachSlotModal.booking
          const data = b?.data && typeof b.data === 'object' ? b.data : {}
          const coachId = (data.coachId || b?.memberId || '').toString()
          const shares = (b?.paymentShares || []).filter(s => String(s.memberId || '') !== coachId)
          const totalAmount = parseFloat(b?.totalAmount) || 0
          const paidSum = (b?.paymentShares || []).reduce((s, sh) => s + (sh.paidAt ? (parseFloat(sh.amount) || 0) : 0), 0)
          const isConfirmed = b?.status === 'confirmed' || paidSum >= totalAmount - 0.01
          return (
          <div className="coach-slot-modal-backdrop" onClick={() => setCoachSlotModal(null)}>
            <div className="coach-slot-modal coach-slot-modal--booking" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="coach-slot-booking-title">
              <div className="coach-slot-modal-card-head">
                <h3 id="coach-slot-booking-title" className="coach-slot-modal-title">{t('Your booking', 'حجزك', language)}</h3>
              </div>
              <div className="coach-slot-modal-card-body">
                <div className="coach-slot-booking-summary">
                  <p className="coach-slot-modal-info">
                    {language === 'ar' && coachSlotModal.court?.nameAr ? coachSlotModal.court.nameAr : coachSlotModal.court?.name} — {formatDate((b?.date || b?.startDate || '').toString().split('T')[0])}{' '}
                    {b?.startTime || b?.timeSlot || ''}{b?.endTime ? ` – ${b.endTime}` : ''}
                  </p>
                  <p className="coach-slot-modal-price">
                    {t('Total', 'الإجمالي', language)}: <strong>{totalAmount} {currency}</strong>
                    {isConfirmed && <span className="coach-slot-status-confirmed"> ({t('Confirmed', 'مؤكد', language)})</span>}
                  </p>
                  {shares.length > 0 && (
                    <div className="coach-slot-modal-trainees">
                      <p className="coach-slot-modal-trainees-title">{t('Trainees', 'المتدربون', language)}</p>
                      <ul className="coach-slot-modal-trainees-list">
                        {shares.map((s, i) => (
                          <li key={s.id || i}>
                            <span className="trainee-name">{s.memberName || s.phone || t('Member', 'عضو', language)}</span>
                            <span className="trainee-amount">{parseFloat(s.amount) || 0} {currency}</span>
                            <span className="trainee-method">{s.paymentMethod === 'credit_card' ? (language === 'en' ? 'Card' : 'بطاقة') : s.paymentMethod === 'mada' ? 'Mada' : (language === 'en' ? 'At club' : 'في النادي')}</span>
                            {s.paidAt && <span className="trainee-paid">✓</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="coach-slot-invite-panel">
                  <div className="coach-slot-invite-panel-head">
                    <span className="coach-slot-invite-panel-icon" aria-hidden>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fill="#fff" d="M20.52 3.48A11.87 11.87 0 0 0 12.04 0C5.5 0 .27 5.23.27 11.77c0 2.08.54 4.09 1.57 5.87L0 24l6.5-1.7a11.7 11.7 0 0 0 5.53 1.42h.01c6.54 0 11.77-5.23 11.77-11.77 0-3.14-1.22-6.1-3.29-8.47zM12.05 21.5h-.01a9.65 9.65 0 0 1-4.92-1.35l-.35-.21-3.67.96.98-3.58-.23-.37a9.58 9.58 0 0 1-1.47-5.1c0-5.31 4.32-9.63 9.65-9.63 2.58 0 5 1.01 6.82 2.83a9.58 9.58 0 0 1 2.82 6.8c0 5.32-4.32 9.64-9.64 9.64zm5.17-7.04c-.28-.14-1.68-.83-1.94-.93-.26-.09-.45-.14-.64.14-.19.28-.74.93-.9 1.12-.17.19-.33.21-.61.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.39-1.65-1.55-1.93-.17-.28-.02-.43.13-.57.13-.13.28-.33.42-.5.14-.17.19-.28.28-.47.09-.19.05-.35-.02-.5-.07-.14-.64-1.55-.88-2.12-.23-.55-.47-.48-.64-.49h-.55c-.19 0-.5.07-.76.35-.26.1-1 1 1-4.96.26-.45.44-.76.47-1.01.05-.29-.02-.55-.19-.76-.14-.19-.76-.93-2.12-1.24-1.36-.3-2.88-.24-4.09-.14-1.21.1-4.03 1.64-4.45 3.93-.42 2.28.95 4.64 1.11 4.96.16.33 2.5 4.04 6.1 5.53 3.6 1.5 3.6.98 4.25.92.65-.06 2.09-.86 2.39-1.69.3-.83.3-1.55.21-1.69z" />
                      </svg>
                    </span>
                    <div className="coach-slot-invite-panel-titles">
                      <h4 className="coach-slot-modal-invite-title">{t('Invite via WhatsApp', 'دعوة عبر واتساب', language)}</h4>
                      <p className="coach-slot-modal-invite-hint">{t('Sends a club link and records the invite on the member’s account.', 'يُرسل رابط النادي ويُسجَّل الطلب في حساب العضو.', language)}</p>
                    </div>
                  </div>

                  {favoritesIds.length > 0 && (
                    <>
                      <div className="coach-slot-invite-fav-toolbar">
                        <span className="coach-slot-invite-fav-badge">
                          {favoritesIds.length} {t('in favorites', 'في المفضلة', language)}
                        </span>
                        <button
                          type="button"
                          className={`coach-slot-invite-fav-toggle ${inviteModalFavoritesOpen ? 'is-expanded' : ''}`}
                          onClick={toggleInviteModalFavorites}
                          aria-expanded={inviteModalFavoritesOpen}
                          aria-controls="coach-slot-invite-fav-panel"
                        >
                          <span className="coach-slot-invite-fav-toggle-label">
                            {inviteModalFavoritesOpen
                              ? t('Hide favorites', 'إخفاء المفضلة', language)
                              : t('Show favorites', 'إظهار المفضلة', language)}
                          </span>
                          <span className="coach-slot-invite-fav-chevron" aria-hidden />
                        </button>
                      </div>
                      <div
                        id="coach-slot-invite-fav-panel"
                        className={`coach-slot-invite-fav-collapse ${inviteModalFavoritesOpen ? 'is-open' : ''}`}
                        aria-hidden={!inviteModalFavoritesOpen}
                      >
                        <div className="coach-slot-invite-fav-collapse-inner">
                          <ul className="coach-slot-modal-fav-list">
                            {favoritesIds.map(fid => {
                              const m = favoritesMemberMap[fid] || (getClubMembersFromStorage(clubId) || []).find(x => String(x.id) === String(fid)) || (getAllMembersFromStorage() || []).find(x => String(x.id) === String(fid))
                              const rawPhone = normalizeMemberPhone(m?.mobile || m?.phone || '')
                              const label = m ? (m.name || m.email || fid) : fid
                              const initial = label.toString().trim().charAt(0).toUpperCase() || '?'
                              return (
                                <li key={fid} className="coach-slot-modal-fav-row">
                                  <span className="coach-slot-modal-fav-avatar" aria-hidden>{initial}</span>
                                  <span className="coach-slot-modal-fav-name">{label}</span>
                                  <button
                                    type="button"
                                    className="coach-slot-modal-wa-btn"
                                    disabled={!rawPhone || inviteBusyMemberId === fid}
                                    onClick={() => sendTrainingInviteWhatsApp(b, fid, rawPhone)}
                                  >
                                    {language === 'en' ? 'WhatsApp' : 'واتساب'}
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="coach-slot-modal-quick-invite">
                    <label className="coach-slot-modal-quick-label" htmlFor="coach-quick-invite-mobile">{t('Or find member by mobile', 'أو ابحث برقم الجوال', language)}</label>
                    <div className="coach-favorites-phone-row coach-slot-modal-quick-row">
                      <CountryCodeSelect value={countryCode} onChange={setCountryCode} language={language} className="coach-favorites-country-select" />
                      <div className="coach-favorites-phone-field coach-slot-modal-phone-field">
                        <input
                          id="coach-quick-invite-mobile"
                          type="tel"
                          inputMode="numeric"
                          className="coach-favorites-number-input"
                          placeholder={language === 'en' ? 'Mobile' : 'جوال'}
                          value={quickInvitePhone}
                          onChange={e => setQuickInvitePhone(e.target.value)}
                          autoComplete="tel-national"
                        />
                      </div>
                    </div>
                    {(() => {
                      const otherMembers = (getClubMembersFromStorage(clubId) || []).filter(x => String(x?.id) !== String(platformUser?.id))
                      const qDigits = normalizeSearchDigits(countryCode, quickInvitePhone)
                      const minD = countryCode.length + getMinDigitsForCountry(countryCode)
                      if (qDigits.length < minD) return null
                      const match = otherMembers.find(m => {
                        const mp = normalizeMemberPhone(m?.mobile || m?.phone || '')
                        return mp && (mp.includes(qDigits) || qDigits.includes(mp))
                      })
                      if (!match) {
                        return <p className="coach-slot-modal-invite-empty">{t('No club member with this number.', 'لا يوجد عضو بهذا الرقم في النادي.', language)}</p>
                      }
                      const p = normalizeMemberPhone(match.mobile || match.phone || '')
                      return (
                        <div className="coach-slot-modal-quick-match">
                          <span className="coach-slot-modal-quick-match-name">{match.name || match.email || match.id}</span>
                          <button
                            type="button"
                            className="coach-slot-modal-wa-btn"
                            disabled={!p || inviteBusyMemberId === match.id}
                            onClick={() => sendTrainingInviteWhatsApp(b, match.id, p)}
                          >
                            {language === 'en' ? 'WhatsApp' : 'واتساب'}
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
              <div className="coach-slot-modal-actions coach-slot-modal-actions--footer">
                <button type="button" className="coach-slot-modal-btn coach-slot-modal-edit" onClick={() => {
                  const data = b?.data && typeof b.data === 'object' ? b.data : {}
                  const startTime = (b?.startTime || b?.timeSlot || '').toString().trim() || '16:00'
                  let endTime = (b?.endTime || '').toString().trim()
                  if (!endTime && startTime) endTime = addMinutesToTime(startTime, club?.settings?.bookingDuration || 60)
                  setEditSlotForm({
                    booking: b,
                    court: coachSlotModal.court,
                    pricePerHour: parseFloat(data.pricePerHour) || parseFloat(b?.totalAmount) || createPrice,
                    startTime,
                    endTime: endTime || addMinutesToTime(startTime, 60),
                    maxTrainees: data.maxTrainees ?? 4
                  })
                  setCoachSlotModal(null)
                }}>
                  ✏️ {language === 'en' ? 'Edit' : 'تعديل'}
                </button>
                <button type="button" className="coach-slot-modal-btn coach-slot-modal-delete" onClick={() => handleCoachSlotDelete(b?.id)} disabled={!!submitting}>
                  🗑️ {language === 'en' ? 'Delete' : 'حذف'}
                </button>
                <button type="button" className="coach-slot-modal-btn coach-slot-modal-cancel" onClick={() => setCoachSlotModal(null)}>
                  {language === 'en' ? 'Cancel' : 'إلغاء'}
                </button>
              </div>
            </div>
          </div>
          )
        })()}

        {/* Edit slot form modal */}
        {editSlotForm && (() => {
          const b = editSlotForm.booking
          const editDate = (b?.date || b?.startDate || '').toString().split('T')[0] || gridDate
          const editTimeSlots = getTimeSlotsForClub(club, editDate)
          const startM = timeToMinutes(editSlotForm.startTime)
          const endTimeOptions = editTimeSlots.filter(s => timeToMinutes(s) > startM)
          return (
          <div className="coach-slot-modal-backdrop" onClick={() => setEditSlotForm(null)}>
            <div className="coach-slot-modal coach-slot-edit-modal" onClick={e => e.stopPropagation()}>
              <h3>{t('Edit booking', 'تعديل الحجز', language)}</h3>
              <div className="coach-slot-edit-form">
                <div className="coach-slot-edit-row">
                  <label>{t('Price per hour', 'السعر بالساعة', language)} ({currency})</label>
                  <input type="number" min={0} step={1} value={editSlotForm.pricePerHour} onChange={e => setEditSlotForm(f => ({ ...f, pricePerHour: Number(e.target.value) || 0 }))} />
                </div>
                <div className="coach-slot-edit-row">
                  <label>{t('Start time', 'وقت البداية', language)}</label>
                  <select value={editSlotForm.startTime} onChange={e => {
                    const newStart = e.target.value
                    const newStartM = timeToMinutes(newStart)
                    let newEnd = editSlotForm.endTime
                    if (timeToMinutes(newEnd) <= newStartM) {
                      const idx = editTimeSlots.findIndex(s => timeToMinutes(s) > newStartM)
                      newEnd = idx >= 0 ? editTimeSlots[idx] : addMinutesToTime(newStart, 30)
                    }
                    setEditSlotForm(f => ({ ...f, startTime: newStart, endTime: newEnd }))
                  }}>
                    {editTimeSlots.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="coach-slot-edit-row">
                  <label>{t('End time', 'وقت النهاية', language)}</label>
                  <select value={editSlotForm.endTime} onChange={e => setEditSlotForm(f => ({ ...f, endTime: e.target.value }))}>
                    {endTimeOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    {!endTimeOptions.includes(editSlotForm.endTime) && (
                      <option value={editSlotForm.endTime}>{editSlotForm.endTime}</option>
                    )}
                  </select>
                </div>
                <div className="coach-slot-edit-row">
                  <label>{t('Max trainees', 'الحد الأقصى للمتدربين', language)}</label>
                  <select value={editSlotForm.maxTrainees} onChange={e => setEditSlotForm(f => ({ ...f, maxTrainees: Number(e.target.value) }))}>
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="coach-slot-modal-actions">
                <button type="button" className="coach-slot-modal-btn coach-slot-modal-save" onClick={handleCoachSlotEditSave} disabled={!!submitting}>
                  {submitting ? (language === 'en' ? 'Saving...' : 'جاري الحفظ...') : (language === 'en' ? 'Save' : 'حفظ')}
                </button>
                <button type="button" className="coach-slot-modal-btn coach-slot-modal-cancel" onClick={() => setEditSlotForm(null)} disabled={!!submitting}>
                  {language === 'en' ? 'Cancel' : 'إلغاء'}
                </button>
              </div>
            </div>
          </div>
          )
        })()}

        {/* Tabs: Available / Booked / Past */}
        <section className="coach-dashboard-bookings">
          <header className="coach-bookings-panel-head">
            <h2 className="coach-bookings-panel-title">{t('Your sessions', 'جلساتك', language)}</h2>
            <p className="coach-bookings-panel-desc">{t('Manage upcoming availability and bookings.', 'إدارة التوفر والحجوزات القادمة.', language)}</p>
          </header>
          <div className="coach-tabs">
            <button
              type="button"
              className={`coach-tab ${tab === 'available' ? 'active' : ''}`}
              onClick={() => setTab('available')}
            >
              {t('Available slots', 'الأوقات المحددة', language)} {availableSlots.length > 0 && <span className="coach-tab-badge">{availableSlots.length}</span>}
            </button>
            <button
              type="button"
              className={`coach-tab ${tab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setTab('upcoming')}
            >
              {t('Booked', 'محجوزة', language)} {upcoming.length > 0 && <span className="coach-tab-badge">{upcoming.length}</span>}
            </button>
            <button
              type="button"
              className={`coach-tab ${tab === 'past' ? 'active' : ''}`}
              onClick={() => setTab('past')}
            >
              {t('Past', 'السابقة', language)}
            </button>
          </div>
          <div className="coach-bookings-list">
            {tab === 'available' && availableSlots.map(b => {
              const court = (club?.courts || []).find(c => (c.id || c.name) === (b.courtId || b.resource))
              const isSubmittingThis = submitting === `cancel-${b.id}`
              return (
                <div key={b.id} className="coach-booking-card coach-booking-card-available">
                  <div className="coach-booking-main">
                    <span className="coach-booking-date">{formatDate(b.date || b.startDate)}</span>
                    <span className="coach-booking-time">{b.startTime || b.timeSlot} – {b.endTime}</span>
                    <span className="coach-booking-court">{courtName(b.courtId || b.resource)}</span>
                    <span className="coach-booking-price">{b.totalAmount} {currency}</span>
                  </div>
                  <div className="coach-booking-actions">
                    <button
                      type="button"
                      className="coach-booking-btn coach-booking-btn-edit"
                      onClick={() => {
                        const data = b?.data && typeof b.data === 'object' ? b.data : {}
                        const startTime = (b?.startTime || b?.timeSlot || '').toString().trim() || '16:00'
                        let endTime = (b?.endTime || '').toString().trim()
                        if (!endTime && startTime) endTime = addMinutesToTime(startTime, club?.settings?.bookingDuration || 60)
                        setEditSlotForm({
                          booking: b,
                          court: court || { id: b.courtId, name: courtName(b.courtId) },
                          pricePerHour: parseFloat(data.pricePerHour) || createPrice,
                          startTime,
                          endTime: endTime || addMinutesToTime(startTime, 60),
                          maxTrainees: data.maxTrainees ?? 4
                        })
                      }}
                      disabled={!!submitting}
                    >
                      ✏️ {t('Edit', 'تعديل', language)}
                    </button>
                    <button
                      type="button"
                      className="coach-booking-btn coach-booking-btn-delete"
                      onClick={() => handleCoachSlotDelete(b.id)}
                      disabled={!!submitting || isSubmittingThis}
                    >
                      {isSubmittingThis ? '…' : '🗑️'} {t('Delete', 'حذف', language)}
                    </button>
                    <button
                      type="button"
                      className="coach-booking-btn coach-booking-btn-invite"
                      onClick={() => openTrainingInviteModal(b, court || { id: b.courtId || b.resource, name: courtName(b.courtId || b.resource) })}
                      disabled={!!submitting}
                      title={t('Invite members via WhatsApp; request appears in their account.', 'دعوة عبر واتساب؛ يظهر الطلب في حساب العضو.', language)}
                    >
                      {language === 'en' ? 'Invite (WhatsApp)' : 'دعوة (واتساب)'}
                    </button>
                  </div>
                </div>
              )
            })}
            {tab === 'upcoming' && upcoming.map(b => {
              const d = b.data && typeof b.data === 'object' ? b.data : {}
              const maxT = d.maxTrainees ?? 4
              const shares = b.paymentShares || []
              const traineeCount = shares.filter(s => String(s.memberId || s.member_id || '') !== String(platformUser?.id)).length
              const court = (club?.courts || []).find(c => (c.id || c.name) === (b.courtId || b.resource))
              const canInviteMore = traineeCount < maxT
              return (
                <div key={b.id} className="coach-booking-card">
                  <div className="coach-booking-main">
                    <span className="coach-booking-date">{formatDate(b.date || b.startDate)}</span>
                    <span className="coach-booking-time">{b.startTime || b.timeSlot} – {b.endTime}</span>
                    <span className="coach-booking-court">{courtName(b.courtId || b.resource)}</span>
                    <span className="coach-booking-price">{b.totalAmount} {currency}</span>
                  </div>
                  <div className="coach-booking-meta">
                    <span className="coach-booking-trainees">{traineeCount}/{maxT} {t('trainees', 'متدربين', language)}</span>
                    <span className={`coach-booking-status coach-booking-status-${(b.status || '').toLowerCase()}`}>{b.status}</span>
                  </div>
                  {canInviteMore && (
                    <div className="coach-booking-actions coach-booking-actions--secondary">
                      <button
                        type="button"
                        className="coach-booking-btn coach-booking-btn-invite"
                        onClick={() => openTrainingInviteModal(b, court || { id: b.courtId || b.resource, name: courtName(b.courtId || b.resource) })}
                        disabled={!!submitting}
                        title={t('Invite more via WhatsApp', 'دعوة المزيد عبر واتساب', language)}
                      >
                        {language === 'en' ? 'Invite (WhatsApp)' : 'دعوة (واتساب)'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {tab === 'past' && past.map(b => {
              const d = b.data && typeof b.data === 'object' ? b.data : {}
              const maxT = d.maxTrainees ?? 4
              const shares = b.paymentShares || []
              const traineeCount = shares.filter(s => String(s.memberId || '') !== String(platformUser?.id)).length
              return (
                <div key={b.id} className="coach-booking-card">
                  <div className="coach-booking-main">
                    <span className="coach-booking-date">{formatDate(b.date || b.startDate)}</span>
                    <span className="coach-booking-time">{b.startTime || b.timeSlot} – {b.endTime}</span>
                    <span className="coach-booking-court">{courtName(b.courtId || b.resource)}</span>
                    <span className="coach-booking-price">{b.totalAmount} {currency}</span>
                  </div>
                  <div className="coach-booking-meta">
                    <span className="coach-booking-trainees">{traineeCount}/{maxT} {t('trainees', 'متدربين', language)}</span>
                    <span className={`coach-booking-status coach-booking-status-${(b.status || '').toLowerCase()}`}>{b.status}</span>
                  </div>
                </div>
              )
            })}
            {tab === 'available' && availableSlots.length === 0 && (
              <p className="coach-bookings-empty">{t('No available slots. Add some in the schedule above.', 'لا توجد أوقات محددة. أضف من الجدول أعلاه.', language)}</p>
            )}
            {tab === 'upcoming' && upcoming.length === 0 && (
              <p className="coach-bookings-empty">{t('No bookings', 'لا توجد حجوزات', language)}</p>
            )}
            {tab === 'past' && past.length === 0 && (
              <p className="coach-bookings-empty">{t('No past sessions', 'لا توجد جلسات سابقة', language)}</p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default CoachDashboardPage
