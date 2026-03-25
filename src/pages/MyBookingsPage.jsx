import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getMemberBookings, deleteBookingFromClub, getClubById, loadClubs, refreshClubsFromApi, getClubMembersFromStorage, getAllMembersFromStorage } from '../storage/adminStorage'
import * as bookingApi from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import BookingDetailModal from '../components/BookingDetailModal'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './MyBookingsPage.css'
import { findPaymentShareForMember, resolvePaymentShareDisplayName, shareNeedsRefundAcknowledgment } from '../utils/paymentShareMemberMatch.js'

function getBookingDisplayProps({ booking, club }, language) {
  const dateStr = booking.dateStr || booking.date || (booking.startDate && (typeof booking.startDate === 'string' ? booking.startDate : booking.startDate.toISOString?.()?.split('T')[0])) || ''
  const timeStr = (booking.startTime || booking.timeSlot || '') + (booking.endTime ? ` – ${booking.endTime}` : '')
  const isTournament = booking?.isTournament === true
  const courtName = isTournament
    ? (booking.resource || booking.notes || (language === 'en' ? 'Tournament' : 'بطولة'))
    : (booking.resource || booking.courtName || booking.court || (Array.isArray(club?.courts) && booking.courtId && club.courts.find(c => String(c.id) === String(booking.courtId))?.name) || booking.courtId || '—')
  const priceVal = booking.price != null ? booking.price : (booking.totalAmount != null && booking.totalAmount !== '' && booking.totalAmount !== 0 ? booking.totalAmount : null)
  const currencyStr = booking.currency || club?.settings?.currency || 'SAR'
  const clubName = club
    ? (language === 'ar' ? (club.nameAr || club.name) : (club.name || club.nameAr))
    : '—'
  const clubLink = club ? `/clubs/${club.id}` : null
  const isTraining = !isTournament && (booking?.type === 'training' || booking?.data?.type === 'training')
  const st = (booking?.status || '').toString()
  const isAwaitingRefundAck = st === 'cancelled_awaiting_refund_ack'
  const isPaid = ['confirmed'].includes(st) && !isAwaitingRefundAck
  const isPendingPayment = ['pending_payment', 'pending_payments', 'partially_paid', 'initiated', 'locked'].includes(st)
  return { dateStr, timeStr, courtName, priceVal, currencyStr, clubName, clubLink, isTraining, isTournament, isPaid, isPendingPayment, isAwaitingRefundAck }
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
  const [addSplitForBookingId, setAddSplitForBookingId] = useState(null)
  const [addSplitRows, setAddSplitRows] = useState([{ phone: '', amount: '' }])
  const [addSplitBusy, setAddSplitBusy] = useState(false)
  const [addSplitFavorites, setAddSplitFavorites] = useState([])
  const [addSplitFavoritesLoading, setAddSplitFavoritesLoading] = useState(false)

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

  useEffect(() => {
    if (!addSplitForBookingId || !member?.id) {
      setAddSplitFavorites([])
      return
    }
    const entry = bookings.find((x) => String(x.booking?.id) === String(addSplitForBookingId))
    const clubId = entry?.club?.id
    if (!clubId) {
      setAddSplitFavorites([])
      return
    }
    let cancelled = false
    ;(async () => {
      setAddSplitFavoritesLoading(true)
      try {
        const ids = await bookingApi.getFavoriteMembers(member.id, clubId)
        const idList = Array.isArray(ids) ? ids.map(String) : []
        const fromAll = getAllMembersFromStorage() || []
        const fromClub = getClubMembersFromStorage(clubId) || []
        const byId = new Map()
        for (const m of [...fromClub, ...fromAll]) {
          if (m?.id != null) byId.set(String(m.id), m)
        }
        const resolved = idList.map((id) => {
          const m = byId.get(id)
          const phone = (m?.mobile || m?.phone || '').trim()
          return {
            id,
            name: (m?.name || m?.email || id).toString(),
            phone
          }
        })
        if (!cancelled) setAddSplitFavorites(resolved)
      } catch {
        if (!cancelled) setAddSplitFavorites([])
      } finally {
        if (!cancelled) setAddSplitFavoritesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [addSplitForBookingId, member?.id, bookings])

  const applyFavoritePhoneToSplitRows = (phone) => {
    const p = (phone || '').trim()
    if (!p) return
    setAddSplitRows((prev) => {
      const emptyIdx = prev.findIndex((r) => !(r.phone || '').trim())
      if (emptyIdx >= 0) {
        const next = [...prev]
        next[emptyIdx] = { ...next[emptyIdx], phone: p }
        return next
      }
      return [...prev, { phone: p, amount: '' }]
    })
  }

  const today = new Date().toISOString().split('T')[0]
  const normDate = (r) => {
    const d = r.booking.dateStr || r.booking.date || r.booking.startDate || ''
    return typeof d === 'string' ? d.split('T')[0] : (d && d.toISOString ? d.toISOString().split('T')[0] : '')
  }
  const upcoming = bookings.filter(r => normDate(r) >= today)
  const past = bookings.filter(r => normDate(r) < today)
  const displayed = filter === 'upcoming' ? upcoming : past

  const shareMemberDirectory = React.useMemo(() => {
    const byId = new Map()
    for (const m of getAllMembersFromStorage() || []) {
      if (m?.id != null) byId.set(String(m.id), m)
    }
    const clubIds = new Set()
    bookings.forEach(({ club }) => {
      if (club?.id) clubIds.add(club.id)
    })
    clubIds.forEach((cid) => {
      for (const m of getClubMembersFromStorage(cid) || []) {
        if (m?.id != null && !byId.has(String(m.id))) byId.set(String(m.id), m)
      }
    })
    return [...byId.values()]
  }, [bookings])

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
      en: {
        initiated: 'In progress', locked: 'Reserved', pending_payments: 'Awaiting payments', pending_payment: 'Awaiting payment', partially_paid: 'Partial payment', confirmed: 'Confirmed',
        cancelled: 'Cancelled', expired: 'Expired', cancelled_awaiting_refund_ack: 'Cancelled — confirm refund received'
      },
      ar: {
        initiated: 'قيد الإجراء', locked: 'محجوز', pending_payments: 'بانتظار الدفعات', pending_payment: 'بانتظار الدفع', partially_paid: 'دفع جزئي', confirmed: 'مؤكد',
        cancelled: 'ملغي', expired: 'منتهي', cancelled_awaiting_refund_ack: 'ملغي — أكّد استلام الاسترداد'
      }
    }
    return (labels[language] || labels.en)[s] || s
  }

  const getStatusClass = (status) => {
    const s = (status || 'confirmed').toString()
    if (['confirmed'].includes(s)) return 'status-confirmed'
    if (['cancelled_awaiting_refund_ack'].includes(s)) return 'status-refund-ack'
    if (['initiated', 'locked', 'pending_payments', 'pending_payment', 'partially_paid'].includes(s)) return 'status-pending'
    if (['cancelled', 'expired'].includes(s)) return 'status-cancelled'
    return ''
  }

  const handleAckRefund = async (share, clubId) => {
    if (!member?.id || !clubId) return
    setMarkingPayAtClub(`ack-${share.id || share.inviteToken}`)
    try {
      await bookingApi.acknowledgeShareRefund({
        shareId: share.id || undefined,
        inviteToken: share.inviteToken || undefined,
        clubId,
        memberId: member.id,
        phone: member.phone || member.mobile
      })
      window.dispatchEvent(new CustomEvent('clubs-synced'))
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
    } catch (e) {
      console.error(e)
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setMarkingPayAtClub(null)
    }
  }

  const canAddSplitParticipants = (booking, club, m) => {
    if (!m?.id || !club?.id || booking?.isTournament) return false
    const st = (booking.status || '').toString()
    if (['cancelled', 'expired', 'cancelled_awaiting_refund_ack'].includes(st)) return false
    const initiator = String(booking.memberId || booking.initiatorMemberId || '') === String(m.id)
    if (!initiator) return false
    const shares = booking.paymentShares || []
    if (!Array.isArray(shares) || shares.length === 0) return false
    const hasRemoved = shares.some((s) => s.removedAt)
    const data = booking.data && typeof booking.data === 'object' ? booking.data : {}
    return hasRemoved || !!data.splitInviteReopen
  }

  const submitAddSplit = async (booking, club) => {
    if (!club?.id || !booking?.id || !member?.id) return
    const rows = addSplitRows.map((r) => ({
      type: 'unregistered',
      phone: (r.phone || '').trim(),
      amount: parseFloat(r.amount) || 0
    })).filter((r) => r.phone && r.amount > 0)
    if (rows.length === 0) {
      window.alert(language === 'en' ? 'Enter phone and amount for each invitee.' : 'أدخل الجوال والمبلغ لكل مدعو.')
      return
    }
    setAddSplitBusy(true)
    try {
      await bookingApi.addSplitParticipants({ bookingId: booking.id, clubId: club.id, memberId: member.id, paymentShares: rows })
      window.dispatchEvent(new CustomEvent('clubs-synced'))
      await refreshClubsFromApi()
      loadClubs()
      setBookings(getMemberBookings(member.id))
      setAddSplitForBookingId(null)
      setAddSplitRows([{ phone: '', amount: '' }])
    } catch (e) {
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setAddSplitBusy(false)
    }
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
      paymentSuccess: 'Payment completed successfully!',
      typeCourt: 'Court',
      typeTraining: 'Training',
      typeTournament: 'Tournament',
      paidLabel: 'Paid',
      awaitingPayment: 'Awaiting payment',
      splitFavorites: 'Favorites',
      splitFavoritesEmpty: 'No favorites in this club yet. Add them from My favorites.',
      splitFavoritesNoPhone: 'No phone on file',
      splitFavHint: 'Tap a name to fill the phone field.'
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
      paymentSuccess: 'تم الدفع بنجاح!',
      typeCourt: 'ملعب',
      typeTraining: 'حصص تدريب',
      typeTournament: 'بطولة',
      paidLabel: 'مدفوع',
      awaitingPayment: 'بانتظار الدفع',
      splitFavorites: 'المفضلة',
      splitFavoritesEmpty: 'لا يوجد مفضلون في هذا النادي بعد. أضفهم من صفحة المفضلة.',
      splitFavoritesNoPhone: 'لا يوجد جوال',
      splitFavHint: 'اضغط على الاسم لملء الجوال في أول سطر فارغ.'
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
    const userShare = findPaymentShareForMember(booking, member)
    if (userShare?.paidAt) return null
    const inviteToken = userShare?.inviteToken
    const chosePayAtClub = userShare && userShare.paymentMethod === 'at_club' && !userShare.paidAt
    if (userShare && club?.id) {
      return { type: 'share', inviteToken, clubId: club.id, chosePayAtClub, bookingId: booking.id }
    }
    const initiatorChosePayAtClub = isInitiator && (booking?.initiatorPaymentMethod === 'at_club' || booking?.data?.initiatorPaymentMethod === 'at_club')
    if (isInitiator && club?.id) {
      return { type: 'initiator', bookingId: booking.id, clubId: club.id, chosePayAtClub: initiatorChosePayAtClub }
    }
    return null
  }

  const renderBookingRow = ({ booking, club }, i) => {
    let { dateStr, timeStr, courtName, priceVal, currencyStr, clubName, clubLink, isTraining, isTournament, isPaid, isPendingPayment, isAwaitingRefundAck } = getBookingDisplayProps({ booking, club }, language)
    if (!booking.isTournament) {
      const isInitiator = String(booking.memberId || booking.initiatorMemberId || '') === String(member?.id || '')
      if (!isInitiator && member) {
        const share = findPaymentShareForMember(booking, member)
        if (share && share.amount != null && share.amount !== '') {
          priceVal = share.amount
        }
      }
    }
    const priceText = priceVal != null ? `${Number(priceVal)} ${currencyStr}` : '—'
    const isUpcoming = filter === 'upcoming'
    const canCancel = isUpcoming && club && !['cancelled', 'expired', 'cancelled_awaiting_refund_ack'].includes((booking.status || '').toString())
    const payOptions = getPayOptions(booking, club)
    const visibleShares = (booking.paymentShares || []).filter((s) => {
      if (!s.removedAt && !s.removed_at) return true
      return member && shareNeedsRefundAcknowledgment(s, member)
    })
    const showAddSplit = canAddSplitParticipants(booking, club, member)

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
      payOptions,
      isTraining,
      isTournament,
      isPaid,
      isPendingPayment,
      isAwaitingRefundAck,
      visibleShares,
      showAddSplit
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
                      <tr key={r.key} className={`my-bookings-table-row ${r.isTournament ? 'my-bookings-table-row--tournament' : r.isTraining ? 'my-bookings-table-row--training' : 'my-bookings-table-row--court'} ${r.isPaid ? 'my-bookings-table-row--paid' : 'my-bookings-table-row--pending'}`}>
                        <td>{r.formatDate(r.dateStr)}</td>
                        <td>{r.timeStr || '—'}</td>
                        <td>
                          <span className={`my-bookings-type-badge ${r.isTournament ? 'my-bookings-type-badge--tournament' : r.isTraining ? 'my-bookings-type-badge--training' : 'my-bookings-type-badge--court'}`}>
                            {r.isTournament ? c.typeTournament : r.isTraining ? c.typeTraining : c.typeCourt}
                          </span>
                          {r.courtName}
                        </td>
                        <td>
                          {r.clubLink ? (
                            <Link to={r.clubLink} className="my-bookings-club-link">
                              {r.clubName}
                            </Link>
                          ) : r.clubName}
                        </td>
                        <td>{r.priceText}</td>
                        <td>
                          <span className={`my-bookings-payment-badge ${r.isPaid ? 'my-bookings-payment-badge--paid' : 'my-bookings-payment-badge--pending'}`}>
                            {r.isPaid ? c.paidLabel : c.awaitingPayment}
                          </span>
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
                                          aria-pressed={r.payOptions.chosePayAtClub}
                                        >
                                          <span className="my-bookings-pay-menu-icon">🏢</span>
                                          {r.payOptions.chosePayAtClub ? <span className="my-bookings-pay-menu-check" aria-hidden>✓ </span> : null}
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
                                          className={`my-bookings-pay-menu-item ${r.payOptions.chosePayAtClub ? 'my-bookings-pay-menu-item-chosen' : ''}`}
                                          onClick={() => { handleMarkPayAtClub(r.payOptions.clubId, r.payOptions.bookingId); setPayMenuOpen(null) }}
                                          disabled={markingPayAtClub === r.booking.id || r.payOptions.chosePayAtClub}
                                          aria-pressed={r.payOptions.chosePayAtClub}
                                        >
                                          <span className="my-bookings-pay-menu-icon">🏢</span>
                                          {r.payOptions.chosePayAtClub ? <span className="my-bookings-pay-menu-check" aria-hidden>✓ </span> : null}
                                          <span>{r.payOptions.chosePayAtClub ? (language === 'ar' ? 'اخترتها — سأدفع في النادي' : 'Chosen — pay at club') : (markingPayAtClub === r.booking.id ? '…' : c.payAtClub)}</span>
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
                          {Array.isArray(r.visibleShares) && r.visibleShares.length > 0 && (
                            <div className="my-bookings-shares">
                              {r.visibleShares.slice(0, 10).map((s, idx) => (
                                <div key={s.id || idx} className="my-bookings-share-row">
                                  <span>
                                    {(() => {
                                      const lbl = resolvePaymentShareDisplayName(s, shareMemberDirectory)
                                      if (lbl !== '—') return lbl
                                      return s.type === 'unregistered' ? c.pending : '—'
                                    })()}
                                  </span>
                                  <span className={s.refundedAt ? 'my-bookings-refunded' : s.paidAt ? 'my-bookings-paid' : ''}>
                                    {s.refundedAt ? (language === 'en' ? 'Refunded' : 'مسترد') : s.paidAt ? '✓ ' + c.paid : c.pending}
                                  </span>
                                  {shareNeedsRefundAcknowledgment(s, member) && r.club?.id && filter === 'upcoming' && (
                                    <button
                                      type="button"
                                      className="my-bookings-ack-refund-btn"
                                      disabled={!!markingPayAtClub}
                                      onClick={() => handleAckRefund(s, r.club.id)}
                                    >
                                      {language === 'en' ? 'I received refund' : 'استلمت الاسترداد'}
                                    </button>
                                  )}
                                  {s.whatsappLink && !s.paidAt && !s.refundedAt && filter === 'upcoming' && (
                                    <a href={s.whatsappLink} target="_blank" rel="noopener noreferrer" className="my-bookings-resend" title={c.resendInvite}>
                                      💬
                                    </a>
                                  )}
                                </div>
                              ))}
                              {r.visibleShares.length > 10 && (
                                <div className="my-bookings-share-row my-bookings-share-more">
                                  +{r.visibleShares.length - 10} {language === 'en' ? 'more' : 'المزيد'}
                                </div>
                              )}
                            </div>
                          )}
                          {r.showAddSplit && filter === 'upcoming' && r.club && (
                            <div className="my-bookings-add-split">
                              <button
                                type="button"
                                className="my-bookings-add-split-toggle"
                                onClick={() => {
                                  if (addSplitForBookingId === r.booking.id) {
                                    setAddSplitForBookingId(null)
                                  } else {
                                    setAddSplitForBookingId(r.booking.id)
                                    setAddSplitRows([{ phone: '', amount: '' }])
                                  }
                                }}
                              >
                                {language === 'en' ? '+ Add participants (share payment)' : '+ إضافة مشاركين (تقسيم)'}
                              </button>
                              {addSplitForBookingId === r.booking.id && (
                                <div className="my-bookings-add-split-form">
                                  <div className="my-bookings-add-split-favorites">
                                    <p className="my-bookings-add-split-favorites-title">★ {c.splitFavorites}</p>
                                    <p className="my-bookings-add-split-fav-hint">{c.splitFavHint}</p>
                                    {addSplitFavoritesLoading ? (
                                      <div className="my-bookings-add-split-fav-loading">{c.loading}</div>
                                    ) : addSplitFavorites.length === 0 ? (
                                      <p className="my-bookings-add-split-fav-empty">{c.splitFavoritesEmpty}</p>
                                    ) : (
                                      <div className="my-bookings-add-split-fav-chips" role="list">
                                        {addSplitFavorites.map((f) => (
                                          <button
                                            key={f.id}
                                            type="button"
                                            className={`my-bookings-add-split-fav-chip ${f.phone ? '' : 'my-bookings-add-split-fav-chip--muted'}`}
                                            disabled={!f.phone}
                                            onClick={() => applyFavoritePhoneToSplitRows(f.phone)}
                                          >
                                            <span className="my-bookings-add-split-fav-chip-name">{f.name}</span>
                                            {f.phone ? (
                                              <span className="my-bookings-add-split-fav-chip-phone">{f.phone}</span>
                                            ) : (
                                              <span className="my-bookings-add-split-fav-chip-na">{c.splitFavoritesNoPhone}</span>
                                            )}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {addSplitRows.map((row, ri) => (
                                    <div key={ri} className="my-bookings-add-split-row">
                                      <input
                                        type="tel"
                                        placeholder={language === 'en' ? 'Phone' : 'الجوال'}
                                        value={row.phone}
                                        onChange={(e) => setAddSplitRows((prev) => prev.map((x, j) => (j === ri ? { ...x, phone: e.target.value } : x)))}
                                      />
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder={language === 'en' ? 'Amount' : 'المبلغ'}
                                        value={row.amount}
                                        onChange={(e) => setAddSplitRows((prev) => prev.map((x, j) => (j === ri ? { ...x, amount: e.target.value } : x)))}
                                      />
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    className="my-bookings-add-split-more"
                                    onClick={() => setAddSplitRows((prev) => [...prev, { phone: '', amount: '' }])}
                                  >
                                    {language === 'en' ? '+ Another' : '+ سطر'}
                                  </button>
                                  <button
                                    type="button"
                                    className="my-bookings-add-split-submit"
                                    disabled={addSplitBusy}
                                    onClick={() => submitAddSplit(r.booking, r.club)}
                                  >
                                    {addSplitBusy ? '…' : (language === 'en' ? 'Send invites' : 'إرسال الدعوات')}
                                  </button>
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
                  className={`my-bookings-card my-bookings-card-clickable ${r.isTournament ? 'my-bookings-card--tournament' : r.isTraining ? 'my-bookings-card--training' : 'my-bookings-card--court'} ${r.isPaid ? 'my-bookings-card--paid' : 'my-bookings-card--pending'}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailRow(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailRow(r) } }}
                >
                  <div className="my-bookings-card-main">
                    <div className="my-bookings-card-badges">
                      <span className={`my-bookings-type-badge ${r.isTournament ? 'my-bookings-type-badge--tournament' : r.isTraining ? 'my-bookings-type-badge--training' : 'my-bookings-type-badge--court'}`}>
                        {r.isTournament ? c.typeTournament : r.isTraining ? c.typeTraining : c.typeCourt}
                      </span>
                      <span className={`my-bookings-payment-badge ${r.isPaid ? 'my-bookings-payment-badge--paid' : 'my-bookings-payment-badge--pending'}`}>
                        {r.isPaid ? c.paidLabel : c.awaitingPayment}
                      </span>
                    </div>
                    <div className="my-bookings-card-date">
                      {r.formatDate(r.dateStr)}
                    </div>
                    <div className="my-bookings-card-meta">
                      <span className="my-bookings-card-icon" aria-hidden>{r.isTraining ? '\u{1F468}\u200D\u{1F3EB}' : '🏸'}</span>
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
                  {Array.isArray(r.visibleShares) && r.visibleShares.length > 0 && (
                    <div className="my-bookings-card-shares">
                      {r.visibleShares.slice(0, 5).map((s, idx) => (
                        <div key={s.id || idx} className="my-bookings-share-row">
                          <span>
                            {(() => {
                              const lbl = resolvePaymentShareDisplayName(s, shareMemberDirectory)
                              if (lbl !== '—') return lbl
                              return s.type === 'unregistered' ? c.pending : '—'
                            })()}
                          </span>
                          <span className={s.refundedAt ? 'my-bookings-refunded' : s.paidAt ? 'my-bookings-paid' : ''}>
                            {s.refundedAt ? '↩' : s.paidAt ? '✓' : '○'}
                          </span>
                          {shareNeedsRefundAcknowledgment(s, member) && r.club?.id && filter === 'upcoming' && (
                            <button type="button" className="my-bookings-ack-refund-btn" disabled={!!markingPayAtClub} onClick={(e) => { e.stopPropagation(); handleAckRefund(s, r.club.id) }}>
                              {language === 'en' ? 'OK' : '✓'}
                            </button>
                          )}
                          {s.whatsappLink && !s.paidAt && !s.refundedAt && filter === 'upcoming' && (
                            <a href={s.whatsappLink} target="_blank" rel="noopener noreferrer" className="my-bookings-resend" title={c.resendInvite} onClick={(e) => e.stopPropagation()}>💬</a>
                          )}
                        </div>
                      ))}
                      {r.visibleShares.length > 5 && (
                        <div className="my-bookings-share-row my-bookings-share-more">
                          +{r.visibleShares.length - 5}
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
                                aria-pressed={r.payOptions.chosePayAtClub}
                              >
                                <span className="my-bookings-pay-menu-icon">🏢</span>
                                {r.payOptions.chosePayAtClub ? <span className="my-bookings-pay-menu-check" aria-hidden>✓ </span> : null}
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
                                className={`my-bookings-pay-menu-item ${r.payOptions.chosePayAtClub ? 'my-bookings-pay-menu-item-chosen' : ''}`}
                                onClick={() => { handleMarkPayAtClub(r.payOptions.clubId, r.payOptions.bookingId); setPayMenuOpen(null) }}
                                disabled={markingPayAtClub === r.booking.id || r.payOptions.chosePayAtClub}
                                aria-pressed={r.payOptions.chosePayAtClub}
                              >
                                <span className="my-bookings-pay-menu-icon">🏢</span>
                                {r.payOptions.chosePayAtClub ? <span className="my-bookings-pay-menu-check" aria-hidden>✓ </span> : null}
                                {r.payOptions.chosePayAtClub ? (language === 'ar' ? 'اخترتها — سأدفع في النادي' : 'Chosen — pay at club') : (markingPayAtClub === r.booking.id ? '…' : c.payAtClub)}
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
                  {r.showAddSplit && filter === 'upcoming' && r.club && (
                    <div className="my-bookings-add-split my-bookings-add-split--card" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="my-bookings-add-split-toggle"
                        onClick={() => {
                          if (addSplitForBookingId === r.booking.id) {
                            setAddSplitForBookingId(null)
                          } else {
                            setAddSplitForBookingId(r.booking.id)
                            setAddSplitRows([{ phone: '', amount: '' }])
                          }
                        }}
                      >
                        {language === 'en' ? '+ Add participants (share payment)' : '+ إضافة مشاركين (تقسيم)'}
                      </button>
                      {addSplitForBookingId === r.booking.id && (
                        <div className="my-bookings-add-split-form">
                          <div className="my-bookings-add-split-favorites">
                            <p className="my-bookings-add-split-favorites-title">★ {c.splitFavorites}</p>
                            <p className="my-bookings-add-split-fav-hint">{c.splitFavHint}</p>
                            {addSplitFavoritesLoading ? (
                              <div className="my-bookings-add-split-fav-loading">{c.loading}</div>
                            ) : addSplitFavorites.length === 0 ? (
                              <p className="my-bookings-add-split-fav-empty">{c.splitFavoritesEmpty}</p>
                            ) : (
                              <div className="my-bookings-add-split-fav-chips" role="list">
                                {addSplitFavorites.map((f) => (
                                  <button
                                    key={f.id}
                                    type="button"
                                    className={`my-bookings-add-split-fav-chip ${f.phone ? '' : 'my-bookings-add-split-fav-chip--muted'}`}
                                    disabled={!f.phone}
                                    onClick={() => applyFavoritePhoneToSplitRows(f.phone)}
                                  >
                                    <span className="my-bookings-add-split-fav-chip-name">{f.name}</span>
                                    {f.phone ? (
                                      <span className="my-bookings-add-split-fav-chip-phone">{f.phone}</span>
                                    ) : (
                                      <span className="my-bookings-add-split-fav-chip-na">{c.splitFavoritesNoPhone}</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {addSplitRows.map((row, ri) => (
                            <div key={ri} className="my-bookings-add-split-row">
                              <input
                                type="tel"
                                placeholder={language === 'en' ? 'Phone' : 'الجوال'}
                                value={row.phone}
                                onChange={(e) => setAddSplitRows((prev) => prev.map((x, j) => (j === ri ? { ...x, phone: e.target.value } : x)))}
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={language === 'en' ? 'Amount' : 'المبلغ'}
                                value={row.amount}
                                onChange={(e) => setAddSplitRows((prev) => prev.map((x, j) => (j === ri ? { ...x, amount: e.target.value } : x)))}
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            className="my-bookings-add-split-more"
                            onClick={() => setAddSplitRows((prev) => [...prev, { phone: '', amount: '' }])}
                          >
                            {language === 'en' ? '+ Another' : '+ سطر'}
                          </button>
                          <button
                            type="button"
                            className="my-bookings-add-split-submit"
                            disabled={addSplitBusy}
                            onClick={() => submitAddSplit(r.booking, r.club)}
                          >
                            {addSplitBusy ? '…' : (language === 'en' ? 'Send invites' : 'إرسال الدعوات')}
                          </button>
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
            memberDirectory={shareMemberDirectory}
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
