import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getMemberBookings, deleteBookingFromClub, loadClubs, refreshClubsFromApi } from '../storage/adminStorage'
import * as bookingApi from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './MyBookingsPage.css'

const MyBookingsPage = () => {
  const navigate = useNavigate()
  const [member, setMember] = useState(null)
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [cancelling, setCancelling] = useState(null)

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  useEffect(() => {
    const user = getCurrentPlatformUser()
    setMember(user)
    if (!user) {
      navigate(`/login?return=${encodeURIComponent('/my-bookings')}`)
      return
    }
  }, [navigate])

  useEffect(() => {
    if (!member?.id) return
    const load = async () => {
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
    }
    load()
    window.addEventListener('clubs-synced', load)
    return () => window.removeEventListener('clubs-synced', load)
  }, [member?.id])

  const today = new Date().toISOString().split('T')[0]
  const upcoming = bookings.filter(r => (r.booking.dateStr || r.booking.date || '') >= today)
  const past = bookings.filter(r => (r.booking.dateStr || r.booking.date || '') < today)
  const displayed = filter === 'upcoming' ? upcoming : past

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const handleCancel = async (clubId, bookingId, booking) => {
    const msg = language === 'en'
      ? 'Cancel this booking? Refund will be processed within the configured period.'
      : 'إلغاء هذا الحجز؟ سيتم استرداد المبلغ خلال المدة المحددة في الإعدادات.'
    if (!window.confirm(msg)) return
    setCancelling(bookingId)
    try {
      let ok = false
      try {
        await bookingApi.cancelBooking(bookingId)
        ok = true
      } catch (_) {
        ok = await deleteBookingFromClub(clubId, bookingId)
      }
      if (ok) {
        await refreshClubsFromApi()
        loadClubs()
        setBookings(getMemberBookings(member.id))
      }
    } finally {
      setCancelling(null)
    }
  }

  const getStatusLabel = (status) => {
    const s = (status || 'confirmed').toString()
    const labels = {
      en: { initiated: 'In progress', locked: 'Reserved', pending_payments: 'Awaiting payments', partially_paid: 'Partial payment', confirmed: 'Confirmed', cancelled: 'Cancelled', expired: 'Expired' },
      ar: { initiated: 'قيد الإجراء', locked: 'محجوز', pending_payments: 'بانتظار الدفعات', partially_paid: 'دفع جزئي', confirmed: 'مؤكد', cancelled: 'ملغي', expired: 'منتهي' }
    }
    return (labels[language] || labels.en)[s] || s
  }

  const getStatusClass = (status) => {
    const s = (status || 'confirmed').toString()
    if (['confirmed'].includes(s)) return 'status-confirmed'
    if (['initiated', 'locked', 'pending_payments', 'partially_paid'].includes(s)) return 'status-pending'
    if (['cancelled', 'expired'].includes(s)) return 'status-cancelled'
    return ''
  }

  const t = {
    en: {
      myBookings: 'My Bookings',
      backToHome: 'Back to home',
      upcoming: 'Upcoming',
      past: 'Past',
      date: 'Date',
      time: 'Time',
      court: 'Court',
      club: 'Club',
      price: 'Price',
      status: 'Status',
      actions: 'Actions',
      cancel: 'Cancel',
      noBookings: 'No bookings',
      noUpcoming: 'No upcoming bookings.',
      noPast: 'No past bookings.',
      goToClub: 'View club'
    },
    ar: {
      myBookings: 'حجوزاتي',
      backToHome: 'العودة للرئيسية',
      upcoming: 'القادمة',
      past: 'السابقة',
      date: 'التاريخ',
      time: 'الوقت',
      court: 'الملعب',
      club: 'النادي',
      price: 'السعر',
      status: 'الحالة',
      actions: 'إجراءات',
      cancel: 'إلغاء',
      noBookings: 'لا توجد حجوزات',
      noUpcoming: 'لا توجد حجوزات قادمة.',
      noPast: 'لا توجد حجوزات سابقة.',
      goToClub: 'عرض النادي'
    }
  }
  const c = t[language] || t.en

  if (!member) {
    return (
      <div className="my-bookings-page">
        <div className="my-bookings-loading">
          <p>{language === 'en' ? 'Loading...' : 'جاري التحميل...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="my-bookings-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="my-bookings-header">
        <div className="my-bookings-header-inner">
          <Link to="/" className="my-bookings-back">{c.backToHome}</Link>
          <button
            type="button"
            className="my-bookings-lang"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            title={language === 'en' ? 'العربية' : 'English'}
          >
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} />
          </button>
        </div>
      </header>

      <main className="my-bookings-main">
        <h1 className="my-bookings-title">{c.myBookings}</h1>

        <div className="my-bookings-tabs">
          <button
            type="button"
            className={`my-bookings-tab ${filter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setFilter('upcoming')}
          >
            {c.upcoming} ({upcoming.length})
          </button>
          <button
            type="button"
            className={`my-bookings-tab ${filter === 'past' ? 'active' : ''}`}
            onClick={() => setFilter('past')}
          >
            {c.past} ({past.length})
          </button>
        </div>

        {displayed.length === 0 ? (
          <p className="my-bookings-empty">
            {filter === 'upcoming' ? c.noUpcoming : c.noPast}
          </p>
        ) : (
          <div className="my-bookings-table-wrap">
            <table className="my-bookings-table">
              <thead>
                <tr>
                  <th>{c.date}</th>
                  <th>{c.time}</th>
                  <th>{c.court}</th>
                  <th>{c.club}</th>
                  <th>{c.price}</th>
                  <th>{c.status}</th>
                  {filter === 'upcoming' && <th>{c.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {displayed.map(({ booking, club }, i) => (
                  <tr key={`${club.id}-${booking.id}-${i}`}>
                    <td>{formatDate(booking.dateStr || booking.date)}</td>
                    <td>{(booking.startTime || '') + (booking.endTime ? ` – ${booking.endTime}` : '')}</td>
                    <td>{booking.resource || booking.courtName || booking.court || '—'}</td>
                    <td>
                      <Link to={`/clubs/${club.id}`} className="my-bookings-club-link">
                        {language === 'ar' && club.nameAr ? club.nameAr : club.name}
                      </Link>
                    </td>
                    <td>
                      {(booking.price != null ? booking.price : '—')}
                      {booking.currency ? ` ${booking.currency}` : ' SAR'}
                    </td>
                    <td>
                      <span className={`my-bookings-status ${getStatusClass(booking.status)}`}>
                        {getStatusLabel(booking.status)}
                      </span>
                    </td>
                    {filter === 'upcoming' && (
                      <td>
                        <button
                          type="button"
                          className="my-bookings-cancel-btn"
                          onClick={() => handleCancel(club.id, booking.id, booking)}
                          disabled={cancelling === booking.id || ['cancelled', 'expired'].includes((booking.status || '').toString())}
                        >
                          {cancelling === booking.id ? '…' : c.cancel}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

export default MyBookingsPage
