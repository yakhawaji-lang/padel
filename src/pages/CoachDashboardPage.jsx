/**
 * Coach Dashboard - صفحة المدرب
 * تظهر فقط عند تسجيل دخول عضو مدرب في النادي
 * جدول الملاعب بالأوقات مثل الصفحة الرئيسية - الضغط على خلية يضيف/يزيل توفر المدرب
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getClubById, refreshClubsFromApi, updateBookingInClub } from '../storage/adminStorage'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getAppLanguage } from '../storage/languageStorage'
import * as bookingApi from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import MultiDatePicker from '../components/MultiDatePicker'
import { getTimeSlotsForClub, isTimeSlotCoveredByBooking, isSlotInPast, addMinutesToTime, timeToMinutes } from '../utils/coachGridHelpers'
import './CoachDashboardPage.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

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
  const [hoveredRange, setHoveredRange] = useState(null) // { court, courtId, startSlot, endSlot } للنطاق
  const [coachSlotModal, setCoachSlotModal] = useState(null) // { booking, court } — عرض تعديل/حذف
  const [editSlotForm, setEditSlotForm] = useState(null) // { booking, court, pricePerHour, startTime, endTime, maxTrainees }
  const hasTouch = typeof window !== 'undefined' && 'ontouchstart' in window
  const touchSelectRef = React.useRef(null) // { court, courtId, dateStr, startSlot } during touch drag

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

  const handleGridCellClick = useCallback(async (court, dateStr, timeSlot, isCoachSlot, bookingId, bookedItem) => {
    if (submitting) return
    setCreateError('')
    if (isCoachSlot && bookedItem) {
      setCoachSlotModal({ booking: bookedItem, court })
      return
    }
    if (!isCoachSlot) {
      const duration = club?.settings?.bookingDuration ?? 60
      const endTime = addMinutesToTime(timeSlot, duration)
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
    }
  }, [clubId, club?.settings?.bookingDuration, createPrice, createMaxTrainees, platformUser?.id, submitting])

  const maxBookingDuration = useMemo(() => {
    const dp = Array.isArray(club?.settings?.bookingPrices?.durationPrices) ? club.settings.bookingPrices.durationPrices : []
    const minDur = club?.settings?.bookingDuration ?? 60
    const valid = (dp || []).filter(d => (d.durationMinutes || 0) >= minDur).map(d => d.durationMinutes || 0)
    return valid.length > 0 ? Math.max(...valid) : (club?.settings?.bookingDuration ?? 180)
  }, [club?.settings?.bookingPrices?.durationPrices, club?.settings?.bookingDuration])

  const isSlotAdjacentToRange = useCallback((timeSlot, startSlot, endSlot) => {
    const slotM = timeToMinutes(timeSlot)
    const startM = timeToMinutes(startSlot)
    const endM = timeToMinutes(endSlot)
    return slotM === startM - 30 || slotM === endM + 30
  }, [])

  const handleRangeMouseEnter = useCallback((court, timeSlot, canAddForRange) => {
    if (!canAddForRange) return
    const courtId = (court?.id || court?.name || '').toString()
    const setNewRange = () => setHoveredRange({ court, courtId, startSlot: timeSlot, endSlot: timeSlot, fromCanAdd: true })
    if (!hoveredRange || !hoveredRange.fromCanAdd) {
      setNewRange()
      return
    }
    if (hoveredRange.courtId !== courtId) {
      setNewRange()
      return
    }
    if (isSlotAdjacentToRange(timeSlot, hoveredRange.startSlot, hoveredRange.endSlot)) {
      const startM = timeToMinutes(hoveredRange.startSlot)
      const endM = timeToMinutes(hoveredRange.endSlot)
      const slotM = timeToMinutes(timeSlot)
      const newStart = slotM < startM ? timeSlot : hoveredRange.startSlot
      const newEnd = slotM > endM ? timeSlot : hoveredRange.endSlot
      const newDuration = timeToMinutes(newEnd) - timeToMinutes(newStart) + 30
      if (newDuration > maxBookingDuration) return
      setHoveredRange(prev => ({ ...prev, startSlot: newStart, endSlot: newEnd }))
      return
    }
    setNewRange()
  }, [hoveredRange, isSlotAdjacentToRange, maxBookingDuration])

  const handleRangeMouseLeave = useCallback(() => setHoveredRange(null), [])

  const handleTouchMoveRange = useCallback((e) => {
    if (!touchSelectRef.current || !e.touches?.[0]) return
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    if (!el?.getAttribute) return
    const courtId = el.getAttribute('data-court-id')
    const timeSlot = el.getAttribute('data-time-slot')
    const dateStr = el.getAttribute('data-date')
    if (!courtId || !timeSlot || !dateStr || el.getAttribute('data-can-add-range') !== '1') return
    if (courtId !== touchSelectRef.current.courtId) return
    setHoveredRange(prev => {
      if (!prev || prev.courtId !== courtId) return { court: touchSelectRef.current.court, courtId, startSlot: timeSlot, endSlot: timeSlot, fromCanAdd: true }
      const slotM = timeToMinutes(timeSlot)
      const startM = timeToMinutes(prev.startSlot)
      const endM = timeToMinutes(prev.endSlot)
      if (slotM >= startM - 30 && slotM <= endM + 30) {
        const newStart = slotM < startM ? timeSlot : prev.startSlot
        const newEnd = slotM > endM ? timeSlot : prev.endSlot
        const dur = timeToMinutes(newEnd) - timeToMinutes(newStart) + 30
        if (dur <= maxBookingDuration) return { ...prev, startSlot: newStart, endSlot: newEnd }
      }
      return prev
    })
  }, [maxBookingDuration])

  const handleTouchEndRange = useCallback(() => {
    touchSelectRef.current = null
  }, [])

  const handleRangeAdd = useCallback(async (court, dateStr, startSlot, endSlot) => {
    if (submitting) return
    const startM = timeToMinutes(startSlot)
    const endM = timeToMinutes(endSlot)
    const duration = endM - startM + 30
    const endTime = addMinutesToTime(endSlot, 30)
    setCreateError('')
    setSubmitting(`${court.id}-${startSlot}`)
    try {
      await bookingApi.createCoachTrainingSlots({
        clubId,
        courtId: court.id,
        dates: [dateStr],
        startTime: startSlot,
        endTime,
        pricePerHour: createPrice,
        maxTrainees: createMaxTrainees,
        coachId: platformUser?.id
      })
      await refreshClubsFromApi()
      setClub(getClubById(clubId))
      setHoveredRange(null)
    } catch (err) {
      setCreateError(err?.message || t('Failed to create slot', 'فشل في إنشاء الحجز', language))
    } finally {
      setSubmitting(null)
    }
  }, [clubId, createPrice, createMaxTrainees, platformUser?.id, submitting])

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
              <p className="coach-panel-subtitle">{t('Select date, click empty slots to add. Click your slots to edit or delete.', 'اختر التاريخ واضغط على الفراغ للإضافة، أو على حجزك للتعديل/الحذف.', language)}</p>
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
            <div
              className="coach-court-grid-scroll"
              onMouseLeave={handleRangeMouseLeave}
              onTouchMove={hasTouch ? handleTouchMoveRange : undefined}
              onTouchEnd={hasTouch ? handleTouchEndRange : undefined}
              onTouchCancel={hasTouch ? handleTouchEndRange : undefined}
            >
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
                  {timeSlots.map(t => (
                    <div key={t} className="club-public-court-grid-time-header">{t}</div>
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
                        const traineeCount = isCoachSlot && bookedItem ? (bookedItem.paymentShares || []).filter(s => String(s.memberId || '') !== String(platformUser?.id || '')).length : 0
                        const isCoachSlotWithTrainees = isCoachSlot && traineeCount > 0
                        const isOtherBooked = bookedItem && !isCoachSlot
                        const isPast = isSlotInPast(dateStr, timeSlot)
                        const cellKey = `${court.id}-${timeSlot}`
                        const isSubmittingThis = submitting === cellKey || (bookedItem?.id && submitting === `cancel-${bookedItem.id}`)
                        const canAdd = !bookedItem && !isPast
                        const canRemove = isCoachSlot
                        const canClick = (canAdd || canRemove) && !isSubmittingThis
                        const cellStatus = isCoachSlot ? (isCoachSlotWithTrainees ? 'coach-slot coach-slot-with-trainees' : 'coach-slot coach-slot-empty') : isOtherBooked ? 'booked' : isPast ? 'past' : 'available'
                        const slotTitle = isCoachSlot ? (language === 'en' ? 'Click to edit or delete' : 'اضغط للتعديل أو الحذف') : isOtherBooked ? t('Booked', 'محجوز', language) : isPast ? t('Past', 'منتهي', language) : canAdd ? (language === 'en' ? 'Click to add availability' : 'اضغط لإضافة التوفر') : ''
                        const canAddForRange = canAdd
                        const isInRange = hoveredRange && hoveredRange.courtId === courtIdForMatch && (() => {
                          const slotM = timeToMinutes(timeSlot)
                          const startM = timeToMinutes(hoveredRange.startSlot)
                          const endM = timeToMinutes(hoveredRange.endSlot)
                          return slotM >= startM && slotM <= endM
                        })()
                        let slotPrice = null
                        if (canClick) {
                          if (isInRange && hoveredRange && canAdd) {
                            const startM = timeToMinutes(hoveredRange.startSlot)
                            const endM = timeToMinutes(hoveredRange.endSlot)
                            const dur = endM - startM + 30
                            slotPrice = Math.round(createPrice * (dur / 60) * 100) / 100
                          } else if (canAdd && !isInRange) {
                            const dur = club?.settings?.bookingDuration ?? 60
                            slotPrice = Math.round(createPrice * (dur / 60) * 100) / 100
                          } else if (isCoachSlot && bookedItem?.totalAmount != null) {
                            slotPrice = parseFloat(bookedItem.totalAmount) || 0
                          }
                        }
                        const handleCellClick = () => {
                          if (isCoachSlot) {
                            handleGridCellClick(court, dateStr, timeSlot, isCoachSlot, bookedItem?.id, bookedItem)
                            return
                          }
                          if (hasTouch && canAddForRange && !isInRange) {
                            handleRangeMouseEnter(court, timeSlot, canAddForRange)
                            return
                          }
                          if (isInRange && hoveredRange && hoveredRange.startSlot !== hoveredRange.endSlot) {
                            handleRangeAdd(court, dateStr, hoveredRange.startSlot, hoveredRange.endSlot)
                            return
                          }
                          handleGridCellClick(court, dateStr, timeSlot, isCoachSlot, bookedItem?.id, bookedItem)
                        }
                        const isCoachSlotHovered = isCoachSlot && hoveredRange?.courtId === courtIdForMatch && hoveredRange?.startSlot === timeSlot
                        return (
                          <div
                            key={timeSlot}
                            role={canClick ? 'button' : undefined}
                            tabIndex={canClick ? 0 : undefined}
                            className={`club-public-court-grid-cell coach-grid-cell ${cellStatus} ${canClick ? 'clickable' : ''} ${isInRange ? 'in-range hovered' : ''} ${isCoachSlotHovered ? 'hovered' : ''}`}
                            title={slotTitle}
                            {...(canAddForRange && { 'data-court-id': courtIdForMatch, 'data-date': dateStr, 'data-time-slot': timeSlot, 'data-can-add-range': '1' })}
                            onMouseEnter={canAddForRange ? () => handleRangeMouseEnter(court, timeSlot, canAddForRange) : (canClick ? () => setHoveredRange({ court, courtId: courtIdForMatch, startSlot: timeSlot, endSlot: timeSlot, fromCanAdd: false }) : undefined)}
                            onTouchStart={hasTouch && canAddForRange ? () => { touchSelectRef.current = { court, courtId: courtIdForMatch, dateStr, startSlot: timeSlot } } : undefined}
                            onClick={canClick ? handleCellClick : undefined}
                            onKeyDown={canClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellClick() } } : undefined}
                          >
                            {(isInRange || isCoachSlotHovered) && slotPrice != null ? (
                              <span className="coach-cell-price">{slotPrice} {currency}</span>
                            ) : isCoachSlot ? (
                              <span className="coach-slot-cell-content" title={slotTitle}>
                                <span className="coach-slot-icon">🏸</span>
                                <span className="coach-slot-hint">✏️🗑️</span>
                              </span>
                            ) : (
                              ''
                            )}
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
            <div className="coach-slot-modal" onClick={e => e.stopPropagation()}>
              <h3>{t('Your booking', 'حجزك', language)}</h3>
              <div className="coach-slot-modal-details">
                <p className="coach-slot-modal-info">
                  {language === 'ar' && coachSlotModal.court?.nameAr ? coachSlotModal.court.nameAr : coachSlotModal.court?.name} — {formatDate((b?.date || b?.startDate || '').toString().split('T')[0])} {b?.startTime || b?.timeSlot || ''}{b?.endTime ? ` – ${b.endTime}` : ''}
                </p>
                <p className="coach-slot-modal-price">
                  {t('Total', 'الإجمالي', language)}: <strong>{totalAmount} {currency}</strong>
                  {isConfirmed && <span className="coach-slot-status-confirmed"> ({t('Confirmed', 'مؤكد', language)})</span>}
                </p>
                {shares.length > 0 && (
                  <div className="coach-slot-modal-trainees">
                    <p className="coach-slot-modal-trainees-title">{t('Trainees', 'المتدربون', language)}:</p>
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
              <div className="coach-slot-modal-actions">
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
                  </div>
                </div>
              )
            })}
            {tab === 'upcoming' && upcoming.map(b => {
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
