/**
 * Coach Dashboard - صفحة المدرب
 * تظهر فقط عند تسجيل دخول عضو مدرب في النادي
 * جدول الملاعب بالأوقات مثل الصفحة الرئيسية - الضغط على خلية يضيف/يزيل توفر المدرب
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getClubById, refreshClubsFromApi } from '../storage/adminStorage'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getAppLanguage } from '../storage/languageStorage'
import * as bookingApi from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import MultiDatePicker from '../components/MultiDatePicker'
import { getTimeSlotsForClub, isTimeSlotCoveredByBooking, isSlotInPast, addMinutesToTime } from '../utils/coachGridHelpers'
import './CoachDashboardPage.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const CoachDashboardPage = () => {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [club, setClub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [gridDate, setGridDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [createPrice, setCreatePrice] = useState(150)
  const [createMaxTrainees, setCreateMaxTrainees] = useState(4)
  const [submitting, setSubmitting] = useState(null)
  const [createError, setCreateError] = useState('')
  const [hoveredSlot, setHoveredSlot] = useState(null) // { courtId, timeSlot } للتمرير وعرض السعر

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
      return d.type === 'training' && String(d.coachId || b.memberId || '') === String(platformUser?.id || '')
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
    const upcomingCount = upcoming.length
    const pastCount = past.length
    const totalRevenue = bookings.reduce((s, b) => s + (parseFloat(b.paidAmount) || 0), 0)
    return { total, upcomingCount, pastCount, totalRevenue }
  }, [bookings, upcoming, past])

  const datesWithCoachSlots = useMemo(() => {
    const set = new Set()
    ;(club?.bookings || []).forEach(b => {
      const d = b.data && typeof b.data === 'object' ? b.data : {}
      if (d.type === 'training' && String(d.coachId || b.memberId || '') === String(platformUser?.id || '')) {
        const dateStr = (b.date || b.startDate || '').toString().split('T')[0]
        if (dateStr && dateStr >= todayStr) set.add(dateStr)
      }
    })
    return Array.from(set)
  }, [club?.bookings, platformUser?.id, todayStr])

  const handleGridCellClick = useCallback(async (court, dateStr, timeSlot, isCoachSlot, bookingId) => {
    if (submitting) return
    setCreateError('')
    if (isCoachSlot && bookingId) {
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
    } else if (!isCoachSlot) {
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
        {/* Stats */}
        <section className="coach-dashboard-stats">
          <div className="coach-stat-card">
            <span className="coach-stat-value">{stats.total}</span>
            <span className="coach-stat-label">{t('Total sessions', 'إجمالي الجلسات', language)}</span>
          </div>
          <div className="coach-stat-card">
            <span className="coach-stat-value">{stats.upcomingCount}</span>
            <span className="coach-stat-label">{t('Upcoming', 'القادمة', language)}</span>
          </div>
          <div className="coach-stat-card">
            <span className="coach-stat-value">{stats.pastCount}</span>
            <span className="coach-stat-label">{t('Past', 'السابقة', language)}</span>
          </div>
          <div className="coach-stat-card coach-stat-revenue">
            <span className="coach-stat-value">{stats.totalRevenue} {currency}</span>
            <span className="coach-stat-label">{t('Revenue', 'الإيرادات', language)}</span>
          </div>
        </section>

        {/* Create training slots - Court grid like main page */}
        <section className="coach-dashboard-create">
          <h2>{t('Set your availability', 'حدد أوقات تواجدك', language)}</h2>
          <p className="coach-create-hint">{t('Select a date, then click empty slots to add availability. Click your slots to remove.', 'اختر تاريخاً ثم اضغط على الأوقات الفارغة للإضافة. اضغط على حجوزاتك للإزالة.', language)}</p>
          <div className="coach-create-date-row">
            <label>{t('Select date', 'اختر التاريخ', language)} — {t('Days with your slots', 'أيام فيها حجوزاتك', language)}:</label>
            <MultiDatePicker
              viewingDate={gridDate}
              onDateClick={setGridDate}
              highlightedDates={datesWithCoachSlots}
              minDate={todayStr}
              language={language}
            />
          </div>
          <div className="coach-create-config">
            <div className="coach-create-row coach-create-row-inline">
              <label>{t('Price per hour', 'السعر بالساعة', language)} ({currency})</label>
              <input type="number" min={1} value={createPrice} onChange={e => setCreatePrice(Number(e.target.value) || 0)} />
            </div>
            <div className="coach-create-row coach-create-row-inline">
              <label>{t('Max trainees', 'الحد الأقصى', language)}</label>
              <select value={createMaxTrainees} onChange={e => setCreateMaxTrainees(Number(e.target.value))}>
                {[1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          {datesWithCoachSlots.length > 0 && (
            <p className="coach-dates-badge">{t('You have slots on', 'لديك أوقات في')} {datesWithCoachSlots.length} {t('day(s)', 'يوم', language)}</p>
          )}
          {createError && <p className="coach-create-error">{createError}</p>}
          <div className="coach-court-grid-wrap" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {(() => {
              const courts = (club?.courts || []).filter(c => !c.maintenance)
              const timeSlots = getTimeSlotsForClub(club)
              if (courts.length === 0) return <p className="coach-no-courts">{t('No courts', 'لا توجد ملاعب', language)}</p>
              return (
                <div
                  className="coach-court-grid club-public-court-grid club-public-court-grid-times-horizontal"
                  style={{
                    gridTemplateColumns: `80px repeat(${timeSlots.length}, minmax(60px, 1fr))`,
                    gridTemplateRows: `40px repeat(${courts.length}, 36px)`,
                    minWidth: `${80 + timeSlots.length * 60}px`
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
                          return d.type === 'training' && String(d.coachId || bookedItem.memberId || '') === String(platformUser?.id || '')
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
                        const slotTitle = isCoachSlot ? (language === 'en' ? 'Click to remove' : 'اضغط للإزالة') : isOtherBooked ? t('Booked', 'محجوز', language) : isPast ? t('Past', 'منتهي', language) : canAdd ? (language === 'en' ? 'Click to add availability' : 'اضغط لإضافة التوفر') : ''
                        const slotKey = `${court.id || court.name}-${timeSlot}`
                        const isHovered = hoveredSlot === slotKey
                        let slotPrice = null
                        if (canClick) {
                          if (canAdd) {
                            const dur = club?.settings?.bookingDuration ?? 60
                            slotPrice = Math.round(createPrice * (dur / 60) * 100) / 100
                          } else if (isCoachSlot && bookedItem?.totalAmount != null) {
                            slotPrice = parseFloat(bookedItem.totalAmount) || 0
                          }
                        }
                        return (
                          <div
                            key={timeSlot}
                            role={canClick ? 'button' : undefined}
                            tabIndex={canClick ? 0 : undefined}
                            className={`club-public-court-grid-cell coach-grid-cell ${cellStatus} ${canClick ? 'clickable' : ''} ${isHovered ? 'hovered' : ''}`}
                            title={slotTitle}
                            onMouseEnter={canClick ? () => setHoveredSlot(slotKey) : undefined}
                            onMouseLeave={canClick ? () => setHoveredSlot(null) : undefined}
                            onClick={canClick ? () => handleGridCellClick(court, dateStr, timeSlot, isCoachSlot, bookedItem?.id) : undefined}
                            onKeyDown={canClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleGridCellClick(court, dateStr, timeSlot, isCoachSlot, bookedItem?.id) } } : undefined}
                          >
                            {isHovered && slotPrice != null ? (
                              <span className="coach-cell-price">{slotPrice} {currency}</span>
                            ) : isCoachSlot ? (
                              '🏸'
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
        </section>

        {/* Confirmed days */}
        {confirmedDates.length > 0 && (
          <section className="coach-dashboard-confirmed">
            <h2>{t('Confirmed days', 'الأيام المؤكدة', language)}</h2>
            <div className="coach-confirmed-grid">
              {confirmedDates.map(({ date, courtId, count }) => (
                <div key={date} className="coach-confirmed-card">
                  <span className="coach-confirmed-date">{formatDate(date)}</span>
                  <span className="coach-confirmed-court">{courtName(courtId)}</span>
                  <span className="coach-confirmed-count">{count} {t('slot(s)', 'حجز', language)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tabs: Upcoming / Past */}
        <section className="coach-dashboard-bookings">
          <div className="coach-tabs">
            <button
              type="button"
              className={`coach-tab ${tab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setTab('upcoming')}
            >
              {t('Upcoming', 'القادمة', language)}
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
            {(tab === 'upcoming' ? upcoming : past).map(b => {
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
            {(tab === 'upcoming' ? upcoming : past).length === 0 && (
              <p className="coach-bookings-empty">{t('No bookings', 'لا توجد حجوزات', language)}</p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default CoachDashboardPage
