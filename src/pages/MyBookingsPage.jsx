import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getMemberBookings, deleteBookingFromClub, getClubById, loadClubs, refreshClubsFromApi } from '../storage/adminStorage'
import * as bookingApi from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import BookingDetailModal from '../components/BookingDetailModal'
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
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const fromClubId = searchParams.get('from')
  const paymentSuccess = searchParams.get('payment') === 'success'
  const [member, setMember] = useState(null)
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [cancelling, setCancelling] = useState(null)
  const [markingPayAtClub, setMarkingPayAtClub] = useState(null)
  const [detailRow, setDetailRow] = useState(null)
  const [payMenuOpen, setPayMenuOpen] = useState(null)

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  useEffect(() => {
    const user = getCurrentPlatformUser()
    setMember(user)
    if (!user) {
      const returnTo = (location.pathname + location.search) || '/my-bookings'
      navigate(`/login?return=${encodeURIComponent(returnTo)}`)
      return
    }
  }, [navigate, location.pathname, location.search])

  useEffect(() => {
    const closePayMenu = (e) => {
      if (payMenuOpen && !e.target.closest('.my-bookings-pay-dropdown, .my-bookings-card-pay-wrap')) {
        setPayMenuOpen(null)
      }
    }
    document.addEventListener('click', closePayMenu)
    return () => document.removeEventListener('click', closePayMenu)
  }, [payMenuOpen])

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

  const handleRecordPayment = async (clubId, inviteToken, bookingId) => {
    if (!clubId) return
    let token = inviteToken
    if (!token && bookingId && member?.id) {
      try {
        const d = await bookingApi.getShareInviteToken(bookingId, clubId, member.id)
        token = d?.inviteToken
      } catch (_) {}
    }
    if (!token) return
    setMarkingPayAtClub(`share-${token}`)
    try {
      await bookingApi.recordPayment({ inviteToken: token, clubId, paymentMethod: 'at_club' })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
      setPayMenuOpen(null)
    } catch (e) {
      console.error('recordPayment failed:', e)
    } finally {
      setMarkingPayAtClub(null)
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
      en: { initiated: 'In progress', locked: 'Reserved', pending_payments: 'Awaiting payments', pending_payment: 'Awaiting payment', partially_paid: 'Partial payment', confirmed: 'Confirmed', cancelled: 'Cancelled', expired: 'Expired' },
      ar: { initiated: 'قيد الإجراء', locked: 'محجوز', pending_payments: 'بانتظار الدفعات', pending_payment: 'بانتظار الدفع', partially_paid: 'دفع جزئي', confirmed: 'مؤكد', cancelled: 'ملغي', expired: 'منتهي' }
    }
    return (labels[language] || labels.en)[s] || s
  }

  const getStatusClass = (status) => {
    const s = (status || 'confirmed').toString()
    if (['confirmed'].includes(s)) return 'status-confirmed'
    if (['initiated', 'locked', 'pending_payments', 'pending_payment', 'partially_paid'].includes(s)) return 'status-pending'
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
      pay: 'Pay',
      payAtClub: 'Pay at club',
      payAtClubHint: 'Cash or card at the club',
      payElectronic: 'Pay electronically',
      payElectronicHint: 'Card or Mada online',
      payAtClubConfirm: "I'll pay at club",
      payNow: 'Pay now',
      loading: 'Loading…',
      bookCourt: 'Book a court',
      paymentSuccess: 'Payment completed successfully!'
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
      pay: 'دفع',
      payAtClub: 'الدفع في النادي',
      payAtClubHint: 'كاش أو بطاقة في النادي',
      payElectronic: 'الدفع الإلكتروني',
      payElectronicHint: 'بطاقة أو متاب أونلاين',
      payAtClubConfirm: 'سأدفع في النادي',
      payNow: 'ادفع الآن',
      loading: 'جاري التحميل…',
      bookCourt: 'احجز ملعباً',
      paymentSuccess: 'تم الدفع بنجاح!'
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

  const getPayOptions = (booking, club) => {
    const memberIdStr = String(member?.id || '')
    const isInitiator = String(booking.memberId || booking.initiatorMemberId || '') === memberIdStr
    const userShare = Array.isArray(booking.paymentShares) && booking.paymentShares.find(s => String(s.memberId || '') === memberIdStr)
    if (userShare?.paidAt) return null
    const inviteToken = userShare?.inviteToken
    const chosePayAtClub = userShare && userShare.paymentMethod === 'at_club' && !userShare.paidAt
    if (userShare && club?.id) {
      return { type: 'share', inviteToken, clubId: club.id, chosePayAtClub, bookingId: booking.id }
    }
    if (isInitiator && club?.id) {
      return { type: 'initiator', bookingId: booking.id, clubId: club.id }
    }
    return null
  }

  const renderBookingRow = ({ booking, club }, i) => {
    const { dateStr, timeStr, courtName, priceVal, currencyStr, clubName, clubLink } = getBookingDisplayProps({ booking, club }, language)
    const priceText = priceVal != null ? `${Number(priceVal)} ${currencyStr}` : '—'
    const isUpcoming = filter === 'upcoming'
    const canCancel = isUpcoming && club && !['cancelled', 'expired'].includes((booking.status || '').toString())
    const payOptions = getPayOptions(booking, club)

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
      formatDate,
      payOptions
    }
  }

  const rows = displayed.map((item, i) => renderBookingRow(item, i))

  const backClubFromBookings = (upcoming[0]?.club || past[0]?.club || bookings[0]?.club) || null
  const backClub = fromClubId ? getClubById(fromClubId) : backClubFromBookings
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

      {paymentSuccess && (
        <div className="my-bookings-success-banner" role="alert">
          {c.paymentSuccess}
        </div>
      )}

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
            <Link to={backLink} className="my-bookings-empty-cta">{c.bookCourt}</Link>
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
                          {['pending_payment'].includes((r.booking.status || '').toString()) && filter === 'upcoming' && r.club && (
                            <div className="my-bookings-pay-now-wrap">
                              <Link to={`/pay/${r.booking.id}?method=${r.booking.paymentMethod || 'credit_card'}`} className="my-bookings-pay-now-link">
                                {c.payNow}
                              </Link>
                            </div>
                          )}
                          {['pending_payments', 'partially_paid'].includes((r.booking.status || '').toString()) && filter === 'upcoming' && r.payOptions && (
                            <div className="my-bookings-pay-wrap">
                              <div className="my-bookings-pay-dropdown">
                                <button
                                  type="button"
                                  className={`my-bookings-pay-btn ${payMenuOpen === r.key ? 'my-bookings-pay-btn-open' : ''}`}
                                  onClick={() => setPayMenuOpen(payMenuOpen === r.key ? null : r.key)}
                                  disabled={!!markingPayAtClub}
                                  aria-expanded={payMenuOpen === r.key}
                                  aria-haspopup="true"
                                >
                                  <span className="my-bookings-pay-btn-icon">💳</span>
                                  {c.pay}
                                  <span className="my-bookings-pay-btn-chevron" aria-hidden>▼</span>
                                </button>
                                {payMenuOpen === r.key && (
                                  <div className="my-bookings-pay-menu">
                                    {r.payOptions.type === 'share' ? (
                                      <>
                                        <button
                                          type="button"
                                          className={`my-bookings-pay-menu-item ${r.payOptions.chosePayAtClub ? 'my-bookings-pay-menu-item-chosen' : ''}`}
                                          onClick={() => { handleRecordPayment(r.payOptions.clubId, r.payOptions.inviteToken, r.payOptions.bookingId); setPayMenuOpen(null) }}
                                          disabled={markingPayAtClub || r.payOptions.chosePayAtClub}
                                        >
                                          <span className="my-bookings-pay-menu-icon">🏢</span>
                                          <span>{r.payOptions.chosePayAtClub ? (language === 'ar' ? 'اخترتها — سأدفع في النادي' : 'Chosen — pay at club') : c.payAtClub}</span>
                                        </button>
                                        <Link
                                          to={r.payOptions.inviteToken ? `/pay-share/${r.payOptions.inviteToken}` : `/pay-share/booking/${r.booking.id}?clubId=${r.payOptions.clubId}`}
                                          className="my-bookings-pay-menu-item my-bookings-pay-menu-link"
                                          onClick={() => setPayMenuOpen(null)}
                                        >
                                          <span className="my-bookings-pay-menu-icon">💳</span>
                                          <span>{r.payOptions.chosePayAtClub ? (language === 'ar' ? 'التبديل إلى الدفع الإلكتروني' : 'Switch to electronic payment') : c.payElectronic}</span>
                                        </Link>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          className="my-bookings-pay-menu-item"
                                          onClick={() => { handleMarkPayAtClub(r.payOptions.clubId, r.payOptions.bookingId); setPayMenuOpen(null) }}
                                          disabled={markingPayAtClub === r.booking.id}
                                        >
                                          <span className="my-bookings-pay-menu-icon">🏢</span>
                                          <span>{markingPayAtClub === r.booking.id ? '…' : c.payAtClub}</span>
                                        </button>
                                        <Link
                                          to={`/pay/${r.booking.id}?method=credit_card`}
                                          className="my-bookings-pay-menu-item my-bookings-pay-menu-link"
                                          onClick={() => setPayMenuOpen(null)}
                                        >
                                          <span className="my-bookings-pay-menu-icon">💳</span>
                                          <span>{c.payElectronic}</span>
                                        </Link>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
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
                <article
                  key={r.key}
                  className="my-bookings-card my-bookings-card-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailRow(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailRow(r) } }}
                >
                  <div className="my-bookings-card-main">
                    <div className="my-bookings-card-date">
                      {r.formatDate(r.dateStr)}
                    </div>
                    <div className="my-bookings-card-meta">
                      <span className="my-bookings-card-time">{r.timeStr || '—'}</span>
                      <span className="my-bookings-card-court">{r.courtName}</span>
                    </div>
                    {r.clubLink ? (
                      <Link to={r.clubLink} className="my-bookings-card-club" onClick={(e) => e.stopPropagation()}>
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
                            <a href={s.whatsappLink} target="_blank" rel="noopener noreferrer" className="my-bookings-resend" title={c.resendInvite} onClick={(e) => e.stopPropagation()}>💬</a>
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
                  {['pending_payment'].includes((r.booking.status || '').toString()) && filter === 'upcoming' && r.club && (
                    <div className="my-bookings-card-pay-wrap" onClick={(e) => e.stopPropagation()}>
                      <Link to={`/pay/${r.booking.id}?method=${r.booking.paymentMethod || 'credit_card'}`} className="my-bookings-pay-now-link">
                        {c.payNow}
                      </Link>
                    </div>
                  )}
                  {['pending_payments', 'partially_paid'].includes((r.booking.status || '').toString()) && filter === 'upcoming' && r.payOptions && (
                    <div className="my-bookings-card-pay-wrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`my-bookings-pay-btn ${payMenuOpen === r.key ? 'my-bookings-pay-btn-open' : ''}`}
                        onClick={() => setPayMenuOpen(payMenuOpen === r.key ? null : r.key)}
                        disabled={!!markingPayAtClub}
                      >
                        <span className="my-bookings-pay-btn-icon">💳</span>
                        {c.pay}
                        <span className="my-bookings-pay-btn-chevron" aria-hidden>▼</span>
                      </button>
                      {payMenuOpen === r.key && (
                        <div className="my-bookings-card-pay-menu">
                          {r.payOptions.type === 'share' ? (
                            <>
                              <button
                                type="button"
                                className={`my-bookings-pay-menu-item ${r.payOptions.chosePayAtClub ? 'my-bookings-pay-menu-item-chosen' : ''}`}
                                onClick={() => { handleRecordPayment(r.payOptions.clubId, r.payOptions.inviteToken, r.payOptions.bookingId); setPayMenuOpen(null) }}
                                disabled={!!markingPayAtClub || r.payOptions.chosePayAtClub}
                              >
                                <span className="my-bookings-pay-menu-icon">🏢</span>
                                {r.payOptions.chosePayAtClub ? (language === 'ar' ? 'اخترتها — سأدفع في النادي' : 'Chosen — pay at club') : c.payAtClub}
                              </button>
                              <Link to={r.payOptions.inviteToken ? `/pay-share/${r.payOptions.inviteToken}` : `/pay-share/booking/${r.booking.id}?clubId=${r.payOptions.clubId}`} className="my-bookings-pay-menu-item my-bookings-pay-menu-link" onClick={() => setPayMenuOpen(null)}>
                                <span className="my-bookings-pay-menu-icon">💳</span>
                                {r.payOptions.chosePayAtClub ? (language === 'ar' ? 'التبديل إلى الدفع الإلكتروني' : 'Switch to electronic payment') : c.payElectronic}
                              </Link>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="my-bookings-pay-menu-item"
                                onClick={() => { handleMarkPayAtClub(r.payOptions.clubId, r.payOptions.bookingId); setPayMenuOpen(null) }}
                                disabled={markingPayAtClub === r.booking.id}
                              >
                                <span className="my-bookings-pay-menu-icon">🏢</span>
                                {markingPayAtClub === r.booking.id ? '…' : c.payAtClub}
                              </button>
                              <Link to={`/pay/${r.booking.id}?method=credit_card`} className="my-bookings-pay-menu-item my-bookings-pay-menu-link" onClick={() => setPayMenuOpen(null)}>
                                <span className="my-bookings-pay-menu-icon">💳</span>
                                {c.payElectronic}
                              </Link>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {r.isUpcoming && r.club && (
                    <div className="my-bookings-card-actions" onClick={(e) => e.stopPropagation()}>
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
        {detailRow && (
          <BookingDetailModal
            booking={detailRow.booking}
            club={detailRow.club}
            platformUser={member}
            language={language}
            onClose={() => setDetailRow(null)}
            onUpdated={async () => {
              await refreshClubsFromApi()
              loadClubs()
              const updated = getMemberBookings(member.id)
              setBookings(updated)
              const bid = detailRow?.booking?.id
              if (bid) {
                const row = updated.find(r => String(r.booking?.id) === String(bid))
                if (row) setDetailRow(row)
              }
            }}
          />
        )}
      </main>
    </div>
  )
}

export default MyBookingsPage
