/**
 * Coach Dashboard - صفحة المدرب
 * تظهر فقط عند تسجيل دخول عضو مدرب في النادي
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getClubById, refreshClubsFromApi } from '../storage/adminStorage'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getAppLanguage } from '../storage/languageStorage'
import * as bookingApi from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import MultiDatePicker from '../components/MultiDatePicker'
import './CoachDashboardPage.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const CoachDashboardPage = () => {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [club, setClub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [createDates, setCreateDates] = useState([])
  const [createCourt, setCreateCourt] = useState('')
  const [createStart, setCreateStart] = useState('09:00')
  const [createEnd, setCreateEnd] = useState('10:00')
  const [createPrice, setCreatePrice] = useState(150)
  const [createMaxTrainees, setCreateMaxTrainees] = useState(4)
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')

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

  const handleAddDate = (dateStr) => {
    if (!dateStr || /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && dateStr >= todayStr) {
      setCreateDates(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort())
    }
  }

  const handleCreateSlots = async (e) => {
    e.preventDefault()
    setCreateError('')
    if (!createDates.length || !createCourt || !createStart || !createEnd) {
      setCreateError(t('Select at least one date, court, and time.', 'اختر تاريخاً واحداً على الأقل والملعب والوقت.', language))
      return
    }
    setSubmitting(true)
    try {
      await bookingApi.createCoachTrainingSlots({
        clubId,
        courtId: createCourt,
        dates: createDates,
        startTime: createStart,
        endTime: createEnd,
        pricePerHour: createPrice,
        maxTrainees: createMaxTrainees,
        coachId: platformUser?.id
      })
      await refreshClubsFromApi()
      setClub(getClubById(clubId))
      setCreateDates([])
      setCreateError('')
    } catch (err) {
      setCreateError(err?.message || t('Failed to create slots', 'فشل في إنشاء الحجوزات', language))
    } finally {
      setSubmitting(false)
    }
  }

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

        {/* Create training slots */}
        <section className="coach-dashboard-create">
          <h2>{t('Create training slots', 'إنشاء حجوزات تدريب', language)}</h2>
          <form onSubmit={handleCreateSlots} className="coach-create-form">
            <div className="coach-create-row">
              <label>{t('Select dates', 'اختر التواريخ', language)}</label>
              <MultiDatePicker
                selectedDates={createDates}
                onToggleDate={handleAddDate}
                minDate={todayStr}
                language={language}
              />
            </div>
            <div className="coach-create-row">
              <label>{t('Court', 'الملعب', language)}</label>
              <select value={createCourt} onChange={e => setCreateCourt(e.target.value)} required>
                <option value="">—</option>
                {(club?.courts || []).map(c => (
                  <option key={c.id} value={c.id}>{language === 'ar' ? c.nameAr || c.name : c.name}</option>
                ))}
              </select>
            </div>
            <div className="coach-create-row coach-create-time">
              <label>{t('Time', 'الوقت', language)}</label>
              <input type="time" value={createStart} onChange={e => setCreateStart(e.target.value)} />
              <span>–</span>
              <input type="time" value={createEnd} onChange={e => setCreateEnd(e.target.value)} />
            </div>
            <div className="coach-create-row">
              <label>{t('Price per hour', 'السعر بالساعة', language)} ({currency})</label>
              <input type="number" min={1} value={createPrice} onChange={e => setCreatePrice(Number(e.target.value) || 0)} />
            </div>
            <div className="coach-create-row">
              <label>{t('Max trainees', 'الحد الأقصى للمتدربين', language)}</label>
              <select value={createMaxTrainees} onChange={e => setCreateMaxTrainees(Number(e.target.value))}>
                {[1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            {createError && <p className="coach-create-error">{createError}</p>}
            <button type="submit" className="coach-create-submit" disabled={submitting}>
              {submitting ? t('Saving...', 'جاري الحفظ...', language) : t('Create slots', 'إنشاء الحجوزات', language)}
            </button>
          </form>
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
