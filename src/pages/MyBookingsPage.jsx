import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getMemberBookings, deleteBookingFromClub, loadClubs, refreshClubsFromApi } from '../storage/adminStorage'
import * as bookingApi from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './MyBookingsPage.css'

function getBookingDisplayProps({ booking, club }, language) {
  const dateStr = booking.dateStr || booking.date || (booking.startDate && (typeof booking.startDate === 'string' ? booking.startDate : booking.startDate.toISOString?.()?.split('T')[0])) || ''
  const timeStr = (booking.startTime || booking.timeSlot || '') + (booking.endTime ? ` – ${booking.endTime}` : '')
  const courtName = booking.resource || booking.courtName || booking.court || (Array.isArray(club?.courts) && booking.courtId && club.courts.find(c => String(c.id) === String(booking.courtId))?.name) || booking.courtId || '—'
  const priceVal = booking.price != null ? booking.price : (booking.totalAmount != null && booking.totalAmount !== 0 ? booking.totalAmount : null)
  const currencyStr = booking.currency || club?.settings?.currency || 'SAR'
  const clubName = club
    ? (language === 'ar' ? (club.nameAr || club.name) : (club.name || club.nameAr))
    : '—'
  const clubLink = club ? `/clubs/${club.id}` : null
  return { dateStr, timeStr, courtName, priceVal, currencyStr, clubName, clubLink }
}

const MyBookingsPage = () => {
  const navigate = useNavigate()
  const [member, setMember] = useState(null)
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [cancelling, setCancelling] = useState(null)
  const [markingPayAtClub, setMarkingPayAtClub] = useState(null)

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
    const loadFromApi = async () => {
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
    }
    const syncFromCache = () => {
      loadClubs()
      setBookings(getMemberBookings(member.id))
    }
    loadFromApi()
    window.addEventListener('clubs-synced', syncFromCache)
    return () => window.removeEventListener('clubs-synced', syncFromCache)
  }, [member?.id])

  const today = new Date().toISOString().split('T')[0]
  const normDate = (r) => {
    const d = r.booking.dateStr || r.booking.date || r.booking.startDate || ''
    return typeof d === 'string' ? d.split('T')[0] : (d && d.toISOString ? d.toISOString().split('T')[0] : '')
  }
  const upcoming = bookings.filter(r => normDate(r) >= today)
  const past = bookings.filter(r => normDate(r) < today)
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

  const handleMarkPayAtClub = async (clubId, bookingId) => {
    setMarkingPayAtClub(bookingId)
    try {
      await bookingApi.markPayAtClub(bookingId, clubId)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
    } catch (e) {
      console.error('markPayAtClub failed:', e)
    } finally {
      setMarkingPayAtClub(null)
    }
  }

  const handleCancel = async (clubId, bookingId, booking, club) => {
    const refundDays = club?.settings?.refundDays ?? 3
    const msg = language === 'en'
      ? `Cancel this booking? Refund will be processed within ${refundDays} business days.`
      : `إلغاء هذا الحجز؟ سيتم استرداد المبلغ خلال ${refundDays} أيام عمل.`
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
      if (ok && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clubs-synced'))
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
      goToClub: 'View club',
      participants: 'Participants',
      paid: 'Paid',
      pending: 'Pending',
      resendInvite: 'Resend invite',
      payAtClub: 'Pay at club (cash/card)',
      payAtClubConfirm: "I'll pay at club",
      loading: 'Loading…',
      bookCourt: 'Book a court'
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
      goToClub: 'عرض النادي',
      participants: 'المشاركون',
      paid: 'دفع',
      pending: 'قيد الانتظار',
      resendInvite: 'إعادة إرسال الدعوة',
      payAtClub: 'الدفع في النادي (كاش أو كارد)',
      payAtClubConfirm: 'سأدفع في النادي',
      loading: 'جاري التحميل…',
      bookCourt: 'احجز ملعباً'
    }
  }
  const c = t[language] || t.en

  if (!member) {
    return (
      <div className="my-bookings-page">
        <div className="my-bookings-loading">
          <div className="my-bookings-loading-spinner" aria-hidden />
          <p>{c.loading}</p>
        </div>
      </div>
    )
  }

  const renderBookingRow = ({ booking, club }, i) => {
    const { dateStr, timeStr, courtName, priceVal, currencyStr, clubName, clubLink } = getBookingDisplayProps({ booking, club }, language)
    const priceText = priceVal != null ? `${Number(priceVal)} ${currencyStr}` : '—'
    const isUpcoming = filter === 'upcoming'
    const canCancel = isUpcoming && club && !['cancelled', 'expired'].includes((booking.status || '').toString())

    return {
      key: `${club?.id}-${booking.id}-${i}`,
      dateStr,
      timeStr,
      courtName,
      clubName,
      clubLink,
      club,
      booking,
      priceText,
      getStatusLabel,
      getStatusClass,
      canCancel,
      isUpcoming,
      formatDate
    }
  }

  const rows = displayed.map((item, i) => renderBookingRow(item, i))

  const backClub = (upcoming[0]?.club || past[0]?.club || bookings[0]?.club) || null
  const backLink = backClub ? `/clubs/${backClub.id}` : '/'
  const backText = backClub
    ? (language === 'ar' ? `العودة إلى ${backClub.nameAr || backClub.name}` : `Back to ${backClub.name || backClub.nameAr}`)
    : c.backToHome

  return (
    <div className="my-bookings-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="my-bookings-header">
        <div className="my-bookings-header-inner">
          <Link to={backLink} className="my-bookings-back" aria-label={backText}>
            <span className="my-bookings-back-icon" aria-hidden>←</span>
            <span className="my-bookings-back-text">{backText}</span>
          </Link>
          <h1 className="my-bookings-header-title">{c.myBookings}</h1>
          <button
            type="button"
            className="my-bookings-lang"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            title={language === 'en' ? 'العربية' : 'English'}
            aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
          >
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} />
          </button>
        </div>
      </header>

      <main className="my-bookings-main">
        <div className="my-bookings-tabs" role="tablist" aria-label={c.myBookings}>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'upcoming'}
            className={`my-bookings-tab ${filter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setFilter('upcoming')}
          >
            <span className="my-bookings-tab-label">{c.upcoming}</span>
            <span className="my-bookings-tab-count">{upcoming.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'past'}
            className={`my-bookings-tab ${filter === 'past' ? 'active' : ''}`}
            onClick={() => setFilter('past')}
          >
            <span className="my-bookings-tab-label">{c.past}</span>
            <span className="my-bookings-tab-count">{past.length}</span>
          </button>
        </div>

        {displayed.length === 0 ? (
          <section className="my-bookings-empty" aria-live="polite">
            <div className="my-bookings-empty-icon" aria-hidden />
            <p className="my-bookings-empty-title">{filter === 'upcoming' ? c.noUpcoming : c.noPast}</p>
            <Link to="/" className="my-bookings-empty-cta">{c.bookCourt}</Link>
          </section>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="my-bookings-desktop-table">
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
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <td>{r.formatDate(r.dateStr)}</td>
                        <td>{r.timeStr || '—'}</td>
                        <td>{r.courtName}</td>
                        <td>
                          {r.clubLink ? (
                            <Link to={r.clubLink} className="my-bookings-club-link">
                              {r.clubName}
                            </Link>
                          ) : r.clubName}
                        </td>
                        <td>{r.priceText}</td>
                        <td>
                          <span className={`my-bookings-status ${r.getStatusClass(r.booking.status)}`}>
                            {r.getStatusLabel(r.booking.status)}
                          </span>
                          {['pending_payments', 'partially_paid'].includes((r.booking.status || '').toString()) && filter === 'upcoming' && (
                            <div className="my-bookings-pay-at-club-wrap">
                              <button
                                type="button"
                                className="my-bookings-pay-at-club-btn"
                                onClick={() => handleMarkPayAtClub(r.club?.id, r.booking.id)}
                                disabled={markingPayAtClub === r.booking.id}
                              >
                                {markingPayAtClub === r.booking.id ? '…' : c.payAtClubConfirm}
                              </button>
                              <span className="my-bookings-pay-at-club-hint">{c.payAtClub}</span>
                            </div>
                          )}
                          {Array.isArray(r.booking.paymentShares) && r.booking.paymentShares.length > 0 && (
                            <div className="my-bookings-shares">
                              {r.booking.paymentShares.slice(0, 10).map((s, idx) => (
                                <div key={s.id || idx} className="my-bookings-share-row">
                                  <span>{s.memberName || s.phone || (s.type === 'unregistered' ? c.pending : '—')}</span>
                                  <span className={s.paidAt ? 'my-bookings-paid' : ''}>
                                    {s.paidAt ? '✓ ' + c.paid : c.pending}
                                  </span>
                                  {s.whatsappLink && !s.paidAt && filter === 'upcoming' && (
                                    <a href={s.whatsappLink} target="_blank" rel="noopener noreferrer" className="my-bookings-resend" title={c.resendInvite}>
                                      💬
                                    </a>
                                  )}
                                </div>
                              ))}
                              {r.booking.paymentShares.length > 10 && (
                                <div className="my-bookings-share-row my-bookings-share-more">
                                  +{r.booking.paymentShares.length - 10} {language === 'en' ? 'more' : 'المزيد'}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        {filter === 'upcoming' && (
                          <td>
                            {r.club && (
                              <button
                                type="button"
                                className="my-bookings-cancel-btn"
                                onClick={() => handleCancel(r.club.id, r.booking.id, r.booking, r.club)}
                                disabled={cancelling === r.booking.id || !r.canCancel}
                              >
                                {cancelling === r.booking.id ? '…' : c.cancel}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile: cards */}
            <div className="my-bookings-mobile-cards">
              {rows.map((r) => (
                <article key={r.key} className="my-bookings-card">
                  <div className="my-bookings-card-main">
                    <div className="my-bookings-card-date">
                      {r.formatDate(r.dateStr)}
                    </div>
                    <div className="my-bookings-card-meta">
                      <span className="my-bookings-card-time">{r.timeStr || '—'}</span>
                      <span className="my-bookings-card-court">{r.courtName}</span>
                    </div>
                    {r.clubLink ? (
                      <Link to={r.clubLink} className="my-bookings-card-club">
                        {r.clubName}
                      </Link>
                    ) : (
                      <span className="my-bookings-card-club my-bookings-card-club-plain">{r.clubName}</span>
                    )}
                    <div className="my-bookings-card-price">{r.priceText}</div>
                    <span className={`my-bookings-status ${r.getStatusClass(r.booking.status)}`}>
                      {r.getStatusLabel(r.booking.status)}
                    </span>
                  </div>
                  {Array.isArray(r.booking.paymentShares) && r.booking.paymentShares.length > 0 && (
                    <div className="my-bookings-card-shares">
                      {r.booking.paymentShares.slice(0, 5).map((s, idx) => (
                        <div key={s.id || idx} className="my-bookings-share-row">
                          <span>{s.memberName || s.phone || (s.type === 'unregistered' ? c.pending : '—')}</span>
                          <span className={s.paidAt ? 'my-bookings-paid' : ''}>
                            {s.paidAt ? '✓' : '○'}
                          </span>
                          {s.whatsappLink && !s.paidAt && filter === 'upcoming' && (
                            <a href={s.whatsappLink} target="_blank" rel="noopener noreferrer" className="my-bookings-resend" title={c.resendInvite}>💬</a>
                          )}
                        </div>
                      ))}
                      {r.booking.paymentShares.length > 5 && (
                        <div className="my-bookings-share-row my-bookings-share-more">
                          +{r.booking.paymentShares.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                  {['pending_payments', 'partially_paid'].includes((r.booking.status || '').toString()) && filter === 'upcoming' && (
                    <div className="my-bookings-card-pay-wrap">
                      <button
                        type="button"
                        className="my-bookings-pay-at-club-btn"
                        onClick={() => handleMarkPayAtClub(r.club?.id, r.booking.id)}
                        disabled={markingPayAtClub === r.booking.id}
                      >
                        {markingPayAtClub === r.booking.id ? '…' : c.payAtClubConfirm}
                      </button>
                    </div>
                  )}
                  {r.isUpcoming && r.club && (
                    <div className="my-bookings-card-actions">
                      <Link to={r.clubLink} className="my-bookings-card-link-btn">{c.goToClub}</Link>
                      {r.canCancel && (
                        <button
                          type="button"
                          className="my-bookings-cancel-btn"
                          onClick={() => handleCancel(r.club.id, r.booking.id, r.booking, r.club)}
                          disabled={cancelling === r.booking.id}
                        >
                          {cancelling === r.booking.id ? '…' : c.cancel}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default MyBookingsPage
