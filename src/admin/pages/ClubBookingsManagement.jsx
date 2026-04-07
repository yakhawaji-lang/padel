import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadClubs, getClubById, getClubMembersFromStorage, getAllMembersFromStorage, deleteBookingFromClub, updateBookingInClub } from '../../storage/adminStorage'
import { resolvePaymentShareDisplayName, effectiveSplitPaidSum } from '../../utils/paymentShareMemberMatch'
import { effectiveShareAmount, shareAmountRaw, shareRowIsActive } from '../../utils/paymentShareEffectiveAmounts'
import * as bookingApi from '../../api/dbClient'
import CalendarPicker from '../../components/CalendarPicker'
import HalfHourTimeSelect from '../../components/HalfHourTimeSelect'
import { calculateBookingPrice } from '../../utils/bookingPricing'
import {
  isTerminalBookingStatus,
  isMemberCancelledBooking,
  bookingHasCollectedPayment,
  bookingJsonData,
  hasMemberSelfCancelFlag,
  shareHasMemberRefundPending,
  bookingHasRefundRequestPending,
  bookingRefundPendingPriorityMs,
} from '../../utils/bookingMemberCancel'
import './club-pages-common.css'
import './BookingsManagement.css'

/** Admin list: court rental vs coach training vs tournament (king / social). */
function classifyAdminBooking(b) {
  const d = b?.data && typeof b.data === 'object' ? b.data : {}
  if (b.isTournament) {
    const tt = (b.tournamentType || d.tournamentType || 'king').toString().toLowerCase()
    return tt === 'social' ? 'tournament_social' : 'tournament_king'
  }
  if ((b.type || d.type || '').toString().toLowerCase() === 'training') return 'training'
  return 'court'
}

/** Which bookings tab lists this row (matches filter state in this page). */
function refundFocusFilterForBooking(b, today) {
  const dateStr = (b.date || b.startDate || '').toString().split('T')[0]
  const status = (b.status || '').toString().toLowerCase()
  if (status === 'expired') return 'deadline_expired'
  if (isTerminalBookingStatus(b.status) && status !== 'expired') return 'memberCancelled'
  if ((dateStr || '') >= today) return 'upcoming'
  return 'past'
}

const ClubBookingsManagement = ({ club, language, onRefresh }) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [typeFilter, setTypeFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState(null)
  const [editBooking, setEditBooking] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [expandedPaymentId, setExpandedPaymentId] = useState(null)
  const [splitExtendMinutesDraft, setSplitExtendMinutesDraft] = useState({})
  const [refundSpotlightBookingId, setRefundSpotlightBookingId] = useState(null)
  const spotlightHandledRef = useRef(null)

  const refreshFromCache = () => {
    loadClubs()
    const c = getClubById(club?.id)
    setBookings(Array.isArray(c?.bookings) ? c.bookings : [])
  }

  useEffect(() => {
    if (!club?.id) return
    refreshFromCache()
    const onSynced = () => refreshFromCache()
    window.addEventListener('clubs-synced', onSynced)
    return () => window.removeEventListener('clubs-synced', onSynced)
  }, [club?.id])

  const refreshFromServer = () => {
    refreshFromCache()
    if (onRefresh) onRefresh()
  }

  const today = new Date().toISOString().split('T')[0]
  const { upcoming, past, deadlineExpired, memberCancelled, displayed, typeCounts } = useMemo(() => {
    const withDate = bookings.map(b => ({
      ...b,
      dateStr: (b.date || b.startDate || '').toString().split('T')[0]
    }))
    const upcomingL = withDate.filter(
      b => !isTerminalBookingStatus(b.status) && (b.dateStr || '') >= today
    )
    const pastL = withDate.filter(
      (b) =>
        (b.dateStr || '') < today &&
        (b.status || '').toString().toLowerCase() !== 'expired'
    )
    const deadlineExpired = [...withDate.filter(b => (b.status || '').toString().toLowerCase() === 'expired')].sort(
      (a, b) => String(b.dateStr || '').localeCompare(String(a.dateStr || ''))
    )
    const memberCancelled = [
      ...withDate.filter((b) => {
        if (!isTerminalBookingStatus(b.status)) return false
        if ((b.status || '').toString().toLowerCase() === 'expired') return false
        return true
      })
    ].sort((a, b) => String(b.dateStr || '').localeCompare(String(a.dateStr || '')))
    const timeList =
      filter === 'upcoming'
        ? upcomingL
        : filter === 'past'
          ? pastL
          : filter === 'deadline_expired'
            ? deadlineExpired
            : memberCancelled
    const counts = { all: timeList.length, court: 0, training: 0, tournament: 0 }
    for (const b of timeList) {
      const k = classifyAdminBooking(b)
      if (k === 'court') counts.court += 1
      else if (k === 'training') counts.training += 1
      else counts.tournament += 1
    }
    let disp = timeList
    if (typeFilter !== 'all') {
      disp = timeList.filter((b) => {
        const k = classifyAdminBooking(b)
        if (typeFilter === 'court') return k === 'court'
        if (typeFilter === 'training') return k === 'training'
        if (typeFilter === 'tournament') return k === 'tournament_king' || k === 'tournament_social'
        return true
      })
    }
    return { upcoming: upcomingL, past: pastL, deadlineExpired, memberCancelled, displayed: disp, typeCounts: counts }
  }, [bookings, filter, typeFilter, today])

  useEffect(() => {
    const raw = searchParams.get('focusRefund')
    if (raw !== '1' && raw !== 'true') return
    if (!bookings.length) return

    const withDate = bookings.map((b) => ({
      ...b,
      dateStr: (b.date || b.startDate || '').toString().split('T')[0],
    }))
    const pending = withDate.filter((b) => bookingHasRefundRequestPending(b))
    const target = [...pending].sort(
      (a, b) => bookingRefundPendingPriorityMs(b) - bookingRefundPendingPriorityMs(a)
    )[0]

    const next = new URLSearchParams(searchParams)
    next.delete('focusRefund')
    setSearchParams(next, { replace: true })

    if (!target?.id) return

    setFilter(refundFocusFilterForBooking(target, today))
    setExpandedPaymentId(target.id)
    setRefundSpotlightBookingId(String(target.id))
  }, [bookings, searchParams, setSearchParams, today])

  useEffect(() => {
    if (!refundSpotlightBookingId) return
    if (spotlightHandledRef.current === refundSpotlightBookingId) return
    if (!displayed.some((b) => String(b.id) === refundSpotlightBookingId)) return
    spotlightHandledRef.current = refundSpotlightBookingId

    const sid = refundSpotlightBookingId
    const t = window.setTimeout(() => {
      const el = document.getElementById(`admin-booking-row-${sid}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('booking-row--refund-spotlight')
        window.setTimeout(() => el.classList.remove('booking-row--refund-spotlight'), 4000)
      }
      window.setTimeout(() => {
        setRefundSpotlightBookingId(null)
        spotlightHandledRef.current = null
      }, 4200)
    }, 280)
    return () => clearTimeout(t)
  }, [refundSpotlightBookingId, displayed])

  const bookingStats = useMemo(() => {
    const withDate = bookings.map(b => ({
      ...b,
      dateStr: (b.date || b.startDate || '').toString().split('T')[0]
    }))
    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    let active = 0
    let upcomingN = 0
    let weekUpcoming = 0
    let partialCount = 0
    let pendingPay = 0
    let collected = 0
    let booked = 0
    let deadlineExpiredKpi = 0

    for (const b of withDate) {
      if ((b.status || '').toString().toLowerCase() === 'expired') {
        deadlineExpiredKpi += 1
      }
      if (isTerminalBookingStatus(b.status)) continue
      active += 1
      const ds = b.dateStr || ''
      if (ds >= today) {
        upcomingN += 1
        if (ds <= weekEndStr) weekUpcoming += 1
      }
      const shareOptsKpi = { tournamentData: club?.tournamentData }
      const paid = effectiveSplitPaidSum(b, shareOptsKpi)
      collected += paid
      const totRaw = b.totalAmount ?? b.total_amount
      const tot = parseFloat(totRaw)
      let gross = !Number.isNaN(tot) && tot > 0 ? tot : NaN
      if (Number.isNaN(gross) && b.price != null && b.price !== '') {
        const pr = parseFloat(b.price)
        gross = !Number.isNaN(pr) ? pr : 0
      } else if (Number.isNaN(gross)) {
        gross = 0
      }
      const sharesKpi = Array.isArray(b.paymentShares) ? b.paymentShares : []
      const splitSumKpi = sharesKpi.length
        ? sharesKpi
            .filter((s) => shareRowIsActive(s))
            .reduce((sum, s) => sum + effectiveShareAmount(b, s, shareOptsKpi), 0)
        : 0
      if (splitSumKpi > 0.009) {
        gross = Math.max(Number(gross) || 0, Math.round(splitSumKpi * 100) / 100)
      }
      booked += gross

      const st = (b.status || '').toString().toLowerCase()
      if (st === 'partially_paid') partialCount += 1
      if (['pending_payment', 'pending_payments', 'partially_paid'].includes(st)) pendingPay += 1
    }

    const outstanding = Math.max(0, booked - collected)
    const terminal = withDate.filter(b => isTerminalBookingStatus(b.status)).length
    const collectionRate = booked > 0 ? Math.min(100, Math.max(0, (collected / booked) * 100)) : 0

    return {
      active,
      upcomingN,
      weekUpcoming,
      partialCount,
      pendingPay,
      collected,
      booked,
      outstanding,
      terminal,
      total: bookings.length,
      collectionRate,
      deadlineExpiredKpi
    }
  }, [bookings, today, club?.tournamentData])

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

  const openEditModal = (b) => {
    const dur = b.durationMinutes || 60
    const [h, m] = (b.startTime || '00:00').split(':').map(Number)
    const endM = (h || 0) * 60 + (m || 0) + dur
    const endTime = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
    const resourceVal = b.resource || b.courtName || b.court || ''
    const courts = club?.courts || []
    const matchedCourt = courts.find(c => (c.name || '') === resourceVal || (c.id || '') === (b.courtId || resourceVal))
    setEditBooking(b)
    setEditForm({
      dateStr: b.dateStr || '',
      startTime: b.startTime || '',
      endTime: b.endTime || endTime,
      courtId: matchedCourt?.id || (resourceVal ? '_other' : ''),
      resource: resourceVal,
      memberName: b.memberName || b.customerName || b.customer || '',
      memberId: (members.some(m => String(m.id) === (b.memberId || '')) ? b.memberId : '') || '',
      price: b.price != null ? b.price : '',
      status: b.status || 'confirmed',
      durationMinutes: dur
    })
  }

  const showError = (msg) => {
    if (typeof window !== 'undefined' && window.alert) window.alert(msg)
  }

  const handleSaveEdit = async () => {
    if (!editBooking?.id) return
    setActionLoading('edit')
    try {
      const dur = parseInt(editForm.durationMinutes, 10) || 60
      const [h, m] = (editForm.startTime || '00:00').split(':').map(Number)
      const endM = (h || 0) * 60 + (m || 0) + dur
      const endTime = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
      const court = courts.find(c => c.id === editForm.courtId)
      const courtName = court?.name || editForm.resource || editForm.courtId || ''
      await updateBookingInClub(club.id, editBooking.id, {
        date: editForm.dateStr,
        startDate: editForm.dateStr,
        startTime: editForm.startTime,
        endTime,
        resource: courtName,
        court: courtName,
        courtName: courtName,
        courtId: (editForm.courtId && editForm.courtId !== '_other') ? editForm.courtId : undefined,
        memberName: editForm.memberName,
        customerName: editForm.memberName,
        customer: editForm.memberName,
        memberId: editForm.memberId || undefined,
        price: editForm.price !== '' ? parseFloat(editForm.price) : undefined,
        status: editForm.status,
        durationMinutes: dur
      })
      const stAfter = (editForm.status || '').toString()
      if (['initiated', 'locked', 'pending_payments', 'pending_payment', 'partially_paid'].includes(stAfter)) {
        try {
          await bookingApi.adminExtendSplitPaymentDeadline({ bookingId: editBooking.id, clubId: club.id })
        } catch (e) {
          console.error('adminExtendSplitPaymentDeadline:', e)
        }
      }
      setEditBooking(null)
      refreshFromServer()
    } catch (e) {
      const msg = language === 'en'
        ? `Failed to save: ${e?.message || 'Server error. Try again.'}`
        : `فشل الحفظ: ${e?.message || 'خطأ في الخادم. حاول مرة أخرى.'}`
      showError(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (b) => {
    if (!window.confirm(language === 'en' ? 'Cancel this booking?' : 'إلغاء هذا الحجز؟')) return
    setActionLoading(b.id)
    try {
      await updateBookingInClub(club.id, b.id, { status: 'cancelled' })
      refreshFromServer()
    } catch (e) {
      const msg = language === 'en'
        ? `Failed to cancel: ${e?.message || 'Server error. Try again.'}`
        : `فشل الإلغاء: ${e?.message || 'خطأ في الخادم. حاول مرة أخرى.'}`
      showError(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (bookingId) => {
    if (!window.confirm(language === 'en' ? 'Delete this booking? It will be removed from the list.' : 'حذف هذا الحجز؟ سيتم إزالته من القائمة.')) return
    setActionLoading(bookingId)
    try {
      await deleteBookingFromClub(club.id, bookingId)
      refreshFromServer()
    } catch (e) {
      const msg = language === 'en'
        ? `Failed to delete: ${e?.message || 'Server error. Try again.'}`
        : `فشل الحذف: ${e?.message || 'خطأ في الخادم. حاول مرة أخرى.'}`
      showError(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkSharePaidAtClub = async (share) => {
    if (!club?.id) return
    const key = `share-${share.id}`
    setActionLoading(key)
    try {
      await bookingApi.markSharePaidAtClub(share.inviteToken ? { inviteToken: share.inviteToken, clubId: club.id } : { shareId: share.id, clubId: club.id })
      refreshFromServer()
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
      }
    } finally {
      setActionLoading(null)
    }
  }

  const pickRefundMethodForPaidShares = (paidShares) => {
    const canWallet = paidShares.every((s) => (s.memberId || s.member_id))
    if (!canWallet) {
      if (!window.confirm(c.refundRemoveCashOnlyBecauseGuest)) return null
      return 'cash'
    }
    if (window.confirm(c.refundRemoveChooseWalletQ)) return 'wallet'
    if (!window.confirm(c.refundRemoveChooseCashQ)) return null
    return 'cash'
  }

  const handleAdminRemoveParticipantShare = async (booking, share) => {
    if (!club?.id || !booking?.id) return
    const sid = share?.id
    const tok = share?.inviteToken || share?.invite_token
    if (!sid && !tok) {
      window.alert(language === 'en' ? 'Cannot remove this row (missing share id).' : 'تعذر الإزالة — لا يوجد معرّف للحصة.')
      return
    }
    const key = `remove-share-${sid || tok}`
    const shareOpts = { tournamentData: club?.tournamentData }
    const paid =
      !!(share.paidAt || share.paid_at) &&
      !(share.refundedAt || share.refunded_at) &&
      !(share.removedAt || share.removed_at)

    if (paid) {
      const amt = effectiveShareAmount(booking, share, shareOpts)
      const intro =
        language === 'en'
          ? `This participant paid approximately ${amt} ${club?.settings?.currency || 'SAR'}. Refund before removal.`
          : `دفع هذا المشارك تقريباً ${amt} ${club?.settings?.currency || 'ر.س'}. يلزم الاسترداد قبل الإزالة.`
      if (!window.confirm(intro)) return
      const method = pickRefundMethodForPaidShares([share])
      if (!method) return
      setActionLoading(key)
      try {
        await bookingApi.adminRefundShare({
          clubId: club.id,
          ...(sid != null && sid !== '' ? { shareId: sid } : {}),
          ...(tok ? { inviteToken: tok } : {}),
          refundMethod: method,
          removeFromBooking: true,
          refundNotes: 'admin remove participant',
        })
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
        refreshFromServer()
      } catch (e) {
        window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
      } finally {
        setActionLoading(null)
      }
      return
    }

    const msg =
      language === 'en'
        ? 'Remove this participant from the split? They have not paid yet. Amounts for the booking will be recalculated.'
        : 'إزالة هذا المشارك من التقسيم؟ لم يدفع بعد. سيعاد احتساب مبالغ الحجز.'
    if (!window.confirm(msg)) return
    setActionLoading(key)
    try {
      await bookingApi.adminRemovePendingShare({
        bookingId: booking.id,
        clubId: club.id,
        ...(sid != null && sid !== '' ? { shareId: sid } : {}),
        ...(tok ? { inviteToken: tok } : {}),
      })
      refreshFromServer()
    } catch (e) {
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleResendTournamentShareWhatsApp = async (booking, share) => {
    if (!club?.id || !booking?.id) return
    if (!booking.isTournament) {
      window.alert(language === 'en' ? 'This action is for tournament bookings only.' : 'هذا الإجراء لحجوزات البطولة فقط.')
      return
    }
    const phone = String(share?.phone || '').trim()
    const phoneDig = phone.replace(/\D/g, '')
    if (phoneDig.length < 8) {
      window.alert(language === 'en' ? 'Valid phone number required on this share.' : 'يلزم رقم جوال صالح على هذه الحصة.')
      return
    }
    const amount = effectiveShareAmount(booking, share, { tournamentData: club?.tournamentData })
    if (amount <= 0.009) {
      window.alert(
        language === 'en'
          ? 'Cannot send invite: share amount is zero and booking total is missing or already fully allocated. Set amounts on shares or the booking total.'
          : 'تعذر الإرسال: مبلغ الحصة صفر ولا يوجد إجمالي حجز أو المبالغ مخصصة بالكامل. عيّن مبالغ الحصص أو إجمالي الحجز.'
      )
      return
    }
    const key = `wa-share-${share?.id || share?.inviteToken || phoneDig}`
    setActionLoading(key)
    try {
      const res = await bookingApi.createTournamentGuestFeeShare({
        bookingId: booking.id,
        clubId: club.id,
        phone,
        amount,
        guestKind: 'auto',
        ...(share?.memberName || share?.member_name
          ? { memberName: String(share.memberName || share.member_name).trim() }
          : {}),
      })
      refreshFromServer()
      const wa = res?.whatsappLink || res?.payUrl
      if (wa && typeof window !== 'undefined') {
        window.open(wa, '_blank', 'noopener,noreferrer')
      }
    } catch (e) {
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleFulfillMemberShareRefund = async (shareId, fulfillment) => {
    if (!club?.id || !shareId) return
    const ful = String(fulfillment).toLowerCase()
    const msgEn = {
      cash: 'Confirm cash refund to this participant for their share?',
      wallet: 'Confirm wallet credit for this share refund?',
      electronic: 'Confirm electronic/card refund was processed for this share?',
    }
    const msgAr = {
      cash: 'تأكيد دفع الاسترداد نقداً لهذا المشارك عن حصته؟',
      wallet: 'تأكيد إضافة المبلغ للمحفظة لهذا الاسترداد؟',
      electronic: 'تأكيد تنفيذ الاسترداد الإلكتروني/البطاقة لهذه الحصة؟',
    }
    const msg = (language === 'en' ? msgEn : msgAr)[ful] || (language === 'en' ? 'Confirm?' : 'تأكيد؟')
    if (!window.confirm(msg)) return
    const key = `fulfill-share-refund-${shareId}`
    setActionLoading(key)
    try {
      await bookingApi.adminFulfillMemberShareRefund({ shareId, clubId: club.id, fulfillment: ful })
      refreshFromServer()
    } catch (e) {
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleFulfillMemberRefund = async (b, fulfillment) => {
    if (!club?.id || !b?.id) return
    const ful = String(fulfillment).toLowerCase()
    const msgEn = {
      cash: 'Confirm you handed the refund amount in cash to the customer? Invoice will be voided.',
      wallet: 'Confirm the refund amount was credited to the member wallet? Invoice will be voided.',
      electronic: 'Confirm electronic/card refund was initiated per your bank or gateway? Invoice will be voided.',
    }
    const msgAr = {
      cash: 'تأكيد تسليم المبلغ نقداً للعميل؟ ستُلغى فاتورة الحجز وتُعامل كاسترداد.',
      wallet: 'تأكيد إضافة المبلغ لمحفظة العضو؟ ستُلغى فاتورة الحجز وتُعامل كاسترداد.',
      electronic: 'تأكيد بدء الاسترداد الإلكتروني عبر البنك/البوابة؟ ستُلغى فاتورة الحجز وتُعامل كاسترداد.',
    }
    const msg = (language === 'en' ? msgEn : msgAr)[ful] || (language === 'en' ? 'Confirm?' : 'تأكيد؟')
    if (!window.confirm(msg)) return
    setActionLoading(`fulfill-refund-${b.id}`)
    try {
      await bookingApi.adminFulfillMemberRefund({ bookingId: b.id, clubId: club.id, fulfillment: ful })
      refreshFromServer()
    } catch (e) {
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleConfirmPaidAtClubFull = async (b) => {
    if (!club?.id || !b?.id) return
    const ok = window.confirm(
      language === 'en'
        ? 'Confirm you received the full payment at the club? An invoice will be created if invoicing is enabled.'
        : 'تأكيد استلام كامل المبلغ في النادي؟ ستُنشأ فاتورة إن كانت الفوترة مفعّلة.'
    )
    if (!ok) return
    setActionLoading('confirm-atclub-' + b.id)
    try {
      const res = await bookingApi.confirmPaidAtClubFull({ bookingId: b.id, clubId: club.id })
      const invNo = res?.invoice?.invoiceNumber
      const base =
        typeof window !== 'undefined'
          ? `${window.location.origin}${(import.meta.env.BASE_URL || '/').replace(/\/$/, '') || ''}`
          : ''
      const myBook = `${base}/my-bookings?from=${encodeURIComponent(String(club.id))}`
      if (invNo && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        const msg =
          language === 'en'
            ? `Invoice ${invNo} is ready for your booking. View it in My bookings: ${myBook}`
            : `فاتورتك ${invNo} جاهزة للحجز. اطلع عليها من حجوزاتي: ${myBook}`
        try {
          await navigator.clipboard.writeText(msg)
          window.alert(
            language === 'en'
              ? `Invoice ${invNo} was created. It also appears under Admin → Accounting → Invoices. A message was copied for the member.`
              : `أُنشئت الفاتورة ${invNo}. تظهر أيضاً في لوحة النادي: المحاسبة ← الفواتير. تم نسخ رسالة للعضو.`
          )
        } catch {
          window.alert(
            language === 'en'
              ? `Invoice ${invNo} was created. See Accounting → Invoices.`
              : `أُنشئت الفاتورة ${invNo}. راجع المحاسبة ← الفواتير.`
          )
        }
      } else if (invNo) {
        window.alert(
          language === 'en'
            ? `Invoice ${invNo} was created. See Accounting → Invoices.`
            : `أُنشئت الفاتورة ${invNo}. راجع المحاسبة ← الفواتير.`
        )
      }
      refreshFromServer()
    } catch (e) {
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setActionLoading(null)
    }
  }

  const handlePermanentDelete = async (bookingId) => {
    if (!window.confirm(language === 'en'
      ? 'Permanently delete from database? This cannot be undone.'
      : 'الحذف النهائي من قاعدة البيانات؟ لا يمكن التراجع.')) return
    setActionLoading('perm-' + bookingId)
    try {
      await deleteBookingFromClub(club.id, bookingId)
      refreshFromServer()
    } catch (e) {
      const msg = language === 'en'
        ? `Failed to delete: ${e?.message || 'Server error. Try again.'}`
        : `فشل الحذف النهائي: ${e?.message || 'خطأ في الخادم. حاول مرة أخرى.'}`
      showError(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusLabel = (status, bookingRow = null) => {
    const s = (status || 'confirmed').toString().toLowerCase()
    const labels = {
      en: {
        initiated: 'In progress', locked: 'Reserved', pending_payments: 'Awaiting payments', pending_payment: 'Awaiting payment', partially_paid: 'Partial payment', confirmed: 'Confirmed',
        cancelled: 'Cancelled', expired: 'Expired', cancelled_awaiting_refund_ack: 'Cancelled — awaiting refund confirmation',
        byMember: 'Member cancelled',
        refundedWalletSuffix: 'Paid booking — credited to wallet',
        refundedCashSuffix: 'Paid booking — refunded in cash',
        refundedElecSuffix: 'Paid booking — electronic/bank refund recorded',
      },
      ar: {
        initiated: 'قيد الإجراء', locked: 'محجوز', pending_payments: 'بانتظار الدفعات', pending_payment: 'بانتظار الدفع', partially_paid: 'دفع جزئي', confirmed: 'مؤكد',
        cancelled: 'ملغي', expired: 'منتهي', cancelled_awaiting_refund_ack: 'ملغي — بانتظار تأكيد الاسترداد',
        byMember: 'ملغي من العضو',
        refundedWalletSuffix: 'أُلغي بعد الدفع — أُودع المبلغ في المحفظة',
        refundedCashSuffix: 'أُلغي بعد الدفع — استرداد نقدي',
        refundedElecSuffix: 'أُلغي بعد الدفع — تسجيل استرداد إلكتروني/بنك',
      }
    }
    const L = labels[language] || labels.en
    const base = L[s] || status
    if (bookingRow && isMemberCancelledBooking(bookingRow) && s === 'cancelled') {
      const jd = bookingJsonData(bookingRow)
      const frAt = jd.clubRefundFulfilledAt || bookingRow.clubRefundFulfilledAt
      const frHow = String(jd.clubRefundFulfillment || bookingRow.clubRefundFulfillment || '').toLowerCase()
      if (frAt) {
        if (frHow === 'wallet') return `${L.byMember} · ${L.refundedWalletSuffix}`
        if (frHow === 'cash') return `${L.byMember} · ${L.refundedCashSuffix}`
        if (frHow === 'electronic') return `${L.byMember} · ${L.refundedElecSuffix}`
      }
    }
    if (bookingRow && isMemberCancelledBooking(bookingRow) && ['cancelled', 'cancelled_awaiting_refund_ack'].includes(s)) {
      return `${L.byMember} · ${base}`
    }
    return base
  }

  const getPaymentMethodLabel = (method) => {
    const m = (method || 'at_club').toString()
    const labels = {
      en: {
        at_club: 'At club', credit_card: 'Credit card', mada: 'Mada', electronic: 'Electronic',
        cash: 'Cash', wallet: 'Wallet', electronic_reverse: 'Electronic reversal'
      },
      ar: {
        at_club: 'في النادي', credit_card: 'بطاقة ائتمان', mada: 'مدى', electronic: 'إلكتروني',
        cash: 'نقد', wallet: 'محفظة', electronic_reverse: 'عكس إلكتروني'
      }
    }
    return (labels[language] || labels.en)[m] || m
  }

  const t = {
    en: {
      bookings: 'Bookings',
      pageSubtitle: 'Court rentals, training sessions, and tournaments in one place.',
      statsAria: 'Bookings overview statistics',
      statEyebrow: 'Operations desk',
      statActive: 'Active reservations',
      statActiveHint: 'Non-cancelled in the system',
      statUpcoming: 'Upcoming on calendar',
      statUpcomingHint: 'Today and future dates',
      statWeek: 'Next 7 days',
      statWeekHint: 'Scheduled within a week',
      statPending: 'Awaiting payment',
      statPendingHint: 'Pending or partial checkout',
      statDeadlineExpired: 'Payment deadline expired',
      statDeadlineExpiredHint: 'Bookings marked expired after the pay-by time',
      deadlineExpiredTab: 'Deadline expired',
      statCollected: 'Collected',
      statCollectedHint: 'Paid amounts on active bookings',
      statBooked: 'Booked value',
      statBookedHint: 'From totals & listed prices',
      statOutstanding: 'Outstanding',
      statOutstandingHint: 'Booked value minus collected',
      collectionHealth: 'Collection progress',
      statTotalInList: 'Total rows in list',
      actionsNoRefundNeeded: 'Cancelled before payment — no refund action required.',
      actionsRefundDoneWallet: 'Paid booking — refund completed: amount credited to the member wallet.',
      actionsRefundDoneCash: 'Paid booking — refund completed: cash to customer.',
      actionsRefundDoneElectronic: 'Paid booking — refund completed: electronic/bank (recorded).',
      actionsRefundDoneOther: 'Paid booking — refund marked complete by the club.',
      upcoming: 'Upcoming',
      past: 'Past',
      memberCancelled: 'Cancelled by member',
      filterTimeRange: 'Time range',
      filtersCardHint: 'Choose which bookings appear in the table below.',
      filterByType: 'Booking type',
      filterAll: 'All',
      filterCourts: 'Courts',
      filterTraining: 'Training',
      filterTournaments: 'Tournaments',
      kindCourt: 'Court',
      kindTraining: 'Training',
      kindTournamentKing: 'King of court',
      kindTournamentSocial: 'Social tournament',
      date: 'Date',
      time: 'Time',
      typeCol: 'Type',
      court: 'Court / details',
      customer: 'Customer',
      price: 'Price',
      status: 'Status',
      actions: 'Actions',
      edit: 'Edit',
      cancel: 'Cancel',
      delete: 'Delete',
      permanentDelete: 'Permanent Delete',
      noBookings: 'No bookings found',
      refresh: 'Refresh',
      editBooking: 'Edit booking',
      save: 'Save',
      close: 'Close',
      duration: 'Duration (min)',
      cancelled: 'cancelled',
      confirmed: 'confirmed',
      paymentDetails: 'Payment details',
      paymentType: 'Payment type',
      paymentMethod: 'Payment method',
      splitPayment: 'Split between participants',
      singlePayment: 'Paid by booker',
      totalAmount: 'Total amount',
      collectedAmount: 'Collected',
      remainingAmount: 'Remaining',
      amountPerParticipant: 'Amount per participant',
      participant: 'Participant',
      amount: 'Amount',
      paid: 'Paid',
      payAtClub: 'Pay at club',
      shareRefundPendingBadge: 'Refund requested',
      waitingClubConfirm: 'Waiting for club confirmation',
      booker: 'Booker',
      pending: 'Pending',
      clickToExpand: 'Click to view payment details',
      refundRef: 'Reference / receipt',
      refunded: 'Refunded',
      removedParticipant: 'Removed',
      payerConfirmPending: 'Awaiting payer confirmation',
      refundAckDone: 'Participant confirmed receipt',
      editDisabledTournament: 'Edit tournament blocks from the tournament section of the club app.',
      expiredSplitBannerTitle: 'Split payment deadline passed',
      expiredSplitBannerHint:
        'The system marked this booking expired before all shares were paid. You can extend the deadline; it becomes active again so members can pay or the booker can add invitees.',
      extendMinutesLabel: 'Extension (minutes from now)',
      extendMinutesHint: 'Capped at end of the booking day if that evening is still in the future. Max 43200 (30 days).',
      extendPreset30: '30 min',
      extendPreset1h: '1 h',
      extendPreset2h: '2 h',
      extendPreset24h: '24 h',
      extendSplitDeadlineBtn: 'Extend & reactivate booking',
      extendSplitSuccess: 'Deadline extended. The booking is active again — members will see it under upcoming bookings.',
      importExpiredPaidToWallet: 'Import paid shares → member wallets',
      importExpiredPaidHint:
        'For registered members only: voids share invoices, marks shares refunded, and credits each payer’s club wallet. Guest/unlinked phone shares need a manual refund.',
      importExpiredPaidConfirm:
        'Credit all paid amounts on registered member shares to their wallets and void the related invoices? This cannot be undone.',
      importExpiredPaidSuccess: 'Imported. Paying members were credited in their club wallets.',
      removeParticipant: 'Remove',
      removeParticipantTitle: 'Remove unpaid participant from split',
      resendTournamentWhatsApp: 'WhatsApp again',
      resendTournamentWhatsAppTitle: 'Regenerate invite link and open WhatsApp for this tournament share',
      removeAllTournamentParticipants: 'Remove all pending participants',
      removeAllTournamentParticipantsTitle:
        'Remove every unpaid tournament participant share at once (booker’s own unpaid slot is kept)',
      removeAllTournamentParticipantsConfirm:
        'Remove all unpaid participant shares on this tournament booking? The booker’s own row (if any) stays.',
      removeAllTournamentParticipantsNone: 'No participant shares to remove on this booking.',
      removeAllTournamentParticipantsDone: 'Done. Refresh if the list looks stale.',
      removePaidParticipant: 'Refund & remove',
      removePaidParticipantTitle: 'Refund this payment (cash or wallet) then remove the participant',
      refundRemovePaidIntro:
        'One or more participants already paid. They must be refunded before removal. Approximate total:',
      refundRemoveChooseWalletQ:
        'Credit the refund to each paying member’s club wallet? Press OK for wallet, or Cancel to record cash refunds at the desk instead.',
      refundRemoveChooseCashQ: 'Record cash refund at the desk for each paid participant (no wallet credit)?',
      refundRemoveCashOnlyBecauseGuest:
        'Some paid rows are not linked to a registered member — refunds can only be recorded as cash at the desk. Continue?',
      refundRemovePartialFail: 'Some refunds failed:',
    },
    ar: {
      bookings: 'الحجوزات',
      pageSubtitle: 'حجوزات الملاعب والحصص التدريبية والبطولات في مكان واحد.',
      statsAria: 'إحصائيات نظرة عامة على الحجوزات',
      statEyebrow: 'مكتب العمليات',
      statActive: 'حجوزات نشطة',
      statActiveHint: 'غير ملغاة في النظام',
      statUpcoming: 'قادمة في التقويم',
      statUpcomingHint: 'اليوم والتواريخ القادمة',
      statWeek: 'خلال 7 أيام',
      statWeekHint: 'مجدولة خلال أسبوع',
      statPending: 'بانتظار الدفع',
      statPendingHint: 'دفع معلق أو جزئي',
      statDeadlineExpired: 'منتهية مهلة الدفع',
      statDeadlineExpiredHint: 'حُدِّدت كمنتهية بعد انتهاء مهلة الدفع',
      deadlineExpiredTab: 'المنتهية مهلة الدفع',
      statCollected: 'المحصّل',
      statCollectedHint: 'المبالغ المدفوعة على الحجوزات النشطة',
      statBooked: 'قيمة الحجوزات',
      statBookedHint: 'من الإجماليات والأسعار المعروضة',
      statOutstanding: 'المستحق',
      statOutstandingHint: 'قيمة الحجز ناقص المحصّل',
      collectionHealth: 'تقدم التحصيل',
      statTotalInList: 'إجمالي السجلات',
      actionsNoRefundNeeded: 'أُلغي قبل اكتمال الدفع — لا إجراء استرداد مطلوب.',
      actionsRefundDoneWallet: 'أُلغي بعد اكتمال الدفع — اكتمل الاسترداد: أُضيف المبلغ لمحفظة العضو.',
      actionsRefundDoneCash: 'أُلغي بعد اكتمال الدفع — اكتمل الاسترداد: تسليم نقدي للعميل.',
      actionsRefundDoneElectronic: 'أُلغي بعد اكتمال الدفع — اكتمل الاسترداد: إلكتروني/بنك (مسجّل).',
      actionsRefundDoneOther: 'أُلغي بعد اكتمال الدفع — سجّل النادي اكتمال الاسترداد.',
      upcoming: 'القادمة',
      past: 'السابقة',
      memberCancelled: 'ملغاة من العضو',
      filterTimeRange: 'نطاق الوقت',
      filtersCardHint: 'حدّد أي الحجوزات تظهر في الجدول أدناه.',
      filterByType: 'نوع الحجز',
      filterAll: 'الكل',
      filterCourts: 'ملاعب',
      filterTraining: 'تدريب',
      filterTournaments: 'بطولات',
      kindCourt: 'حجز ملعب',
      kindTraining: 'حصة تدريب',
      kindTournamentKing: 'ملك الملعب',
      kindTournamentSocial: 'بطولة سوشيال',
      date: 'التاريخ',
      time: 'الوقت',
      typeCol: 'النوع',
      court: 'الملعب / التفاصيل',
      customer: 'العميل',
      price: 'السعر',
      status: 'الحالة',
      actions: 'إجراءات',
      edit: 'تعديل',
      cancel: 'إلغاء',
      delete: 'حذف',
      permanentDelete: 'حذف نهائي',
      noBookings: 'لا توجد حجوزات',
      refresh: 'تحديث',
      editBooking: 'تعديل الحجز',
      save: 'حفظ',
      close: 'إغلاق',
      duration: 'المدة (دقيقة)',
      cancelled: 'ملغي',
      confirmed: 'مؤكد',
      paymentDetails: 'تفاصيل الدفع',
      paymentType: 'نوع الدفع',
      paymentMethod: 'طريقة الدفع',
      splitPayment: 'مقسوم بين المشاركين',
      singlePayment: 'دفع فردي من الحاجز',
      totalAmount: 'المبلغ الإجمالي',
      collectedAmount: 'المحصّل',
      remainingAmount: 'المتبقي',
      amountPerParticipant: 'المطلوب من كل مشارك',
      participant: 'المشارك',
      amount: 'المبلغ',
      paid: 'مدفوع',
      payAtClub: 'سيدفع في النادي',
      shareRefundPendingBadge: 'طلب استرداد',
      waitingClubConfirm: 'بانتظار التأكيد من النادي',
      booker: 'الحاجز',
      pending: 'قيد الانتظار',
      clickToExpand: 'انقر لعرض تفاصيل الدفع',
      refundRef: 'مرجع / إيصال',
      refunded: 'مسترد',
      removedParticipant: 'مُزال',
      payerConfirmPending: 'بانتظار تأكيد المسترد',
      refundAckDone: 'أكد المشارك الاستلام',
      editDisabledTournament: 'عدّل مواعيد البطولة من قسم البطولات في تطبيق النادي.',
      expiredSplitBannerTitle: 'انتهت مهلة إكمال تقسيم الدفع',
      expiredSplitBannerHint:
        'عُدّ هذا الحجز منتهياً قبل اكتمال كل الدفعات. يمكنك تمديد المهلة؛ يعود الحجز نشطاً ليتمكن المشاركون من الدفع أو الحاجز من إضافة مدعوين.',
      extendMinutesLabel: 'مدة التمديد (دقائق من الآن)',
      extendMinutesHint: 'يُقيَّد بآخر يوم من يوم الحجز إذا لم يمرّ بعد. الحد الأقصى 43200 دقيقة (30 يوماً).',
      extendPreset30: '٣٠ د',
      extendPreset1h: '١ س',
      extendPreset2h: '٢ س',
      extendPreset24h: '٢٤ س',
      extendSplitDeadlineBtn: 'تمديد المهلة وإعادة تفعيل الحجز',
      extendSplitSuccess: 'تم التمديد. الحجز نشط من جديد — سيظهر للأعضاء ضمن الحجوزات القادمة.',
      importExpiredPaidToWallet: 'استيراد المدفوع إلى محافظ الأعضاء',
      importExpiredPaidHint:
        'للأعضاء المسجلين فقط: يلغي فواتير الحصص، يوسم الحصص كمستردة، ويودع المبلغ في محفظة كل دافع في النادي. ضيوف بدون عضوية تحتاج معالجة يدوية.',
      importExpiredPaidConfirm:
        'إيداع مبالغ المدفوع في محافظ الأعضاء المسجلين وإلغاء فواتير الحصص؟ لا يمكن التراجع.',
      importExpiredPaidSuccess: 'تم الاستيراد. وُجدت أرصدة في محافظ الأعضاء في هذا النادي.',
      removeParticipant: 'إزالة',
      removeParticipantTitle: 'إزالة مشارك لم يدفع من التقسيم',
      resendTournamentWhatsApp: 'واتساب مرة أخرى',
      resendTournamentWhatsAppTitle: 'تجديد رابط الدعوة وفتح واتساب لهذه حصة البطولة',
      removeAllTournamentParticipants: 'إزالة جميع المشاركين المعلقين',
      removeAllTournamentParticipantsTitle:
        'إزالة كل حصص المشاركين غير المدفوعة دفعة واحدة (تبقى حصة الحاجز إن وُجدت)',
      removeAllTournamentParticipantsConfirm:
        'إزالة جميع حصص المشاركين غير المدفوعة في هذا الحجز؟ تبقى حصة الحاجز إن وُجدت.',
      removeAllTournamentParticipantsNone: 'لا توجد حصص مشاركين للإزالة في هذا الحجز.',
      removeAllTournamentParticipantsDone: 'تم. حدّث الصفحة إذا لم يتحدث العرض.',
      removePaidParticipant: 'استرداد وإزالة',
      removePaidParticipantTitle: 'استرداد المبلغ (نقد أو محفظة) ثم إزالة المشارك',
      refundRemovePaidIntro:
        'يوجد مشاركون دفعوا بالفعل — يجب استرداد مبالغهم قبل الإزالة. الإجمالي التقريبي:',
      refundRemoveChooseWalletQ:
        'إيداع الاسترداد في محفظة كل عضو مسجّل في النادي؟ موافق = محفظة، إلغاء = تسجيل استرداد نقدي في الاستقبال.',
      refundRemoveChooseCashQ: 'تسجيل استرداد نقدي في الاستقبال لكل مدفوع (بدون إيداع محفظة)؟',
      refundRemoveCashOnlyBecauseGuest:
        'بعض المدفوعين غير مرتبطين بحساب عضو — يمكن تسجيل الاسترداد نقداً فقط في الاستقبال. المتابعة؟',
      refundRemovePartialFail: 'فشل جزء من الاسترداد:',
    },
  }
  const c = t[language] || t.en

  const handleRemoveAllTournamentParticipants = async (booking) => {
    if (!club?.id || !booking?.id || !booking.isTournament) return
    const key = `remove-all-tournament-shares-${booking.id}`
    const bookerId = String(booking.memberId || booking.initiatorMemberId || booking.member_id || '').trim()
    const shares = Array.isArray(booking.paymentShares) ? booking.paymentShares : []
    const shareOpts = { tournamentData: club?.tournamentData }
    const currency = club?.settings?.currency || 'SAR'

    const isParticipantRow = (s) => {
      const mid = String(s.memberId || s.member_id || '')
      const tok = s.inviteToken || s.invite_token
      const isBookerSlot = bookerId && mid === bookerId && !tok
      return !isBookerSlot
    }
    const active = shares.filter(
      (s) =>
        isParticipantRow(s) &&
        !(s.removedAt || s.removed_at) &&
        !(s.refundedAt || s.refunded_at)
    )
    const paidList = active.filter((s) => s.paidAt || s.paid_at)
    const unpaidCount = active.filter((s) => !(s.paidAt || s.paid_at)).length

    if (active.length === 0) {
      window.alert(c.removeAllTournamentParticipantsNone)
      return
    }

    let refundMethod = null
    if (paidList.length > 0) {
      const totalApprox = paidList.reduce((sum, s) => sum + effectiveShareAmount(booking, s, shareOpts), 0)
      const intro = `${c.refundRemovePaidIntro} ${totalApprox.toFixed(2)} ${currency} (${paidList.length}).`
      if (!window.confirm(intro)) return
      refundMethod = pickRefundMethodForPaidShares(paidList)
      if (!refundMethod) return
    }
    if (!window.confirm(c.removeAllTournamentParticipantsConfirm)) return

    setActionLoading(key)
    try {
      const errors = []
      if (paidList.length > 0 && refundMethod) {
        for (const s of paidList) {
          const sid = s.id
          const tok = s.inviteToken || s.invite_token
          try {
            await bookingApi.adminRefundShare({
              clubId: club.id,
              ...(sid != null && sid !== '' ? { shareId: sid } : {}),
              ...(tok ? { inviteToken: tok } : {}),
              refundMethod,
              removeFromBooking: true,
              refundNotes: 'admin remove all tournament participants',
            })
          } catch (e) {
            errors.push(`${sid || tok || '?'}: ${e?.message || 'error'}`)
          }
        }
      }

      let n = 0
      if (unpaidCount > 0) {
        const res = await bookingApi.adminRemoveAllPendingTournamentShares({
          bookingId: booking.id,
          clubId: club.id,
        })
        n = res?.removedCount ?? res?.removed_count ?? 0
      }

      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      refreshFromServer()

      if (errors.length) {
        window.alert(`${c.refundRemovePartialFail}\n${errors.slice(0, 5).join('\n')}`)
      } else if (paidList.length === 0 && n === 0) {
        window.alert(c.removeAllTournamentParticipantsNone)
      } else {
        window.alert(c.removeAllTournamentParticipantsDone)
      }
    } catch (e) {
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleExtendExpiredSplitDeadline = async (b) => {
    if (!club?.id || !b?.id) return
    const raw = splitExtendMinutesDraft[b.id]
    const defMins = club?.settings?.splitPaymentDeadlineMinutes ?? 30
    const parsed = raw != null && String(raw).trim() !== '' ? parseInt(String(raw), 10) : defMins
    const mins = Number.isFinite(parsed) && parsed > 0 ? Math.min(43200, parsed) : defMins
    setActionLoading('extend-deadline-' + b.id)
    try {
      const res = await bookingApi.adminExtendSplitPaymentDeadline({
        bookingId: b.id,
        clubId: club.id,
        extendMinutes: mins,
      })
      if (res?.skipped) {
        window.alert(
          language === 'en'
            ? 'Nothing to extend for this booking in its current state.'
            : 'لا يوجد ما يمدَّد في حالة هذا الحجز الحالية.'
        )
        return
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      refreshFromServer()
      window.alert(c.extendSplitSuccess)
    } catch (e) {
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleImportExpiredPaidToWallets = async (b) => {
    if (!club?.id || !b?.id) return
    if (!window.confirm(c.importExpiredPaidConfirm)) return
    setActionLoading(`import-expired-${b.id}`)
    try {
      await bookingApi.adminImportExpiredSplitCreditsToWallets({ bookingId: b.id, clubId: club.id })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      refreshFromServer()
      window.alert(c.importExpiredPaidSuccess)
    } catch (e) {
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
    } finally {
      setActionLoading(null)
    }
  }

  const kindLabel = (kind) => ({
    court: c.kindCourt,
    training: c.kindTraining,
    tournament_king: c.kindTournamentKing,
    tournament_social: c.kindTournamentSocial
  }[kind] || kind)

  const formatBookingResource = (b) => {
    if (b.isTournament && Array.isArray(b.tournamentCourtIds) && b.tournamentCourtIds.length > 0) {
      const courtList = club?.courts || []
      const labels = b.tournamentCourtIds.map((id) => {
        const co = courtList.find(x => String(x.id) === String(id) || String(x.name) === String(id) || String(x.nameAr) === String(id))
        return co ? (language === 'ar' ? (co.nameAr || co.name) : co.name) : String(id)
      })
      const sep = language === 'ar' ? '، ' : ', '
      const courtsStr = labels.length <= 2 ? labels.join(sep) : `${labels[0]} · +${labels.length - 1}`
      const title = b.resource || b.courtName || b.court || (language === 'en' ? 'Tournament' : 'بطولة')
      return `${title} · ${courtsStr}`
    }
    return b.resource || b.courtName || b.court || '—'
  }

  const courts = club?.courts || []
  const members = useMemo(() => {
    const byId = new Map()
    for (const m of getClubMembersFromStorage(club?.id) || []) {
      if (m?.id != null) byId.set(String(m.id), m)
    }
    for (const m of getAllMembersFromStorage() || []) {
      if (m?.id != null && !byId.has(String(m.id))) byId.set(String(m.id), m)
    }
    return [...byId.values()]
  }, [club?.id])

  const formatCurrency = (n) => {
    const cur = club?.settings?.currency || 'SAR'
    try {
      return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ar-SA', {
        style: 'currency',
        currency: cur,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Number(n) || 0)
    } catch {
      return `${(Number(n) || 0).toFixed(2)} ${cur}`
    }
  }

  if (!club) return null

  return (
    <div className="club-admin-page">
      <div className="bookings-hub" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <header className="bookings-hub__hero">
          <div className="bookings-hub__hero-main">
            <p className="bookings-hub__eyebrow">{c.statEyebrow}</p>
            <div className="bookings-hub__title-row">
              {club.logo && (
                <img src={club.logo} alt="" className="bookings-hub__club-logo" />
              )}
              <div>
                <h1 className="bookings-hub__title">{c.bookings}</h1>
                <p className="bookings-hub__club-name">{language === 'ar' ? (club.nameAr || club.name) : club.name}</p>
              </div>
            </div>
            <p className="bookings-hub__lead">{c.pageSubtitle}</p>
          </div>
          <div className="bookings-hub__hero-aside">
            <div className="bookings-hub__meter-card">
              <span className="bookings-hub__meter-label">{c.collectionHealth}</span>
              <div className="bookings-hub__meter" role="presentation">
                <div
                  className="bookings-hub__meter-fill"
                  style={{ width: `${bookingStats.collectionRate}%` }}
                />
              </div>
              <span className="bookings-hub__meter-cap western-numerals">
                {bookingStats.booked > 0
                  ? `${bookingStats.collectionRate.toFixed(1)}%`
                  : '—'}
              </span>
            </div>
            <button type="button" className="bookings-hub__refresh" onClick={refreshFromServer}>
              <span aria-hidden>↻</span> {c.refresh}
            </button>
          </div>
        </header>

        <section className="bookings-hub__kpi" aria-label={c.statsAria}>
          <article className="bookings-kpi bookings-kpi--teal">
            <span className="bookings-kpi__label">{c.statActive}</span>
            <strong className="bookings-kpi__value western-numerals">{bookingStats.active}</strong>
            <span className="bookings-kpi__hint">{c.statActiveHint}</span>
          </article>
          <article className="bookings-kpi bookings-kpi--sky">
            <span className="bookings-kpi__label">{c.statUpcoming}</span>
            <strong className="bookings-kpi__value western-numerals">{bookingStats.upcomingN}</strong>
            <span className="bookings-kpi__hint">{c.statUpcomingHint}</span>
          </article>
          <article className="bookings-kpi bookings-kpi--indigo">
            <span className="bookings-kpi__label">{c.statWeek}</span>
            <strong className="bookings-kpi__value western-numerals">{bookingStats.weekUpcoming}</strong>
            <span className="bookings-kpi__hint">{c.statWeekHint}</span>
          </article>
          <article className="bookings-kpi bookings-kpi--amber">
            <span className="bookings-kpi__label">{c.statPending}</span>
            <strong className="bookings-kpi__value western-numerals">{bookingStats.pendingPay}</strong>
            <span className="bookings-kpi__hint">
              {c.statPendingHint}
              {bookingStats.partialCount > 0
                ? ` · ${bookingStats.partialCount} ${language === 'en' ? 'partial' : 'جزئي'}`
                : ''}
            </span>
          </article>
          <article className="bookings-kpi bookings-kpi--rust">
            <span className="bookings-kpi__label">{c.statDeadlineExpired}</span>
            <strong className="bookings-kpi__value western-numerals">{bookingStats.deadlineExpiredKpi}</strong>
            <span className="bookings-kpi__hint">{c.statDeadlineExpiredHint}</span>
          </article>
          <article className="bookings-kpi bookings-kpi--emerald">
            <span className="bookings-kpi__label">{c.statCollected}</span>
            <strong className="bookings-kpi__value western-numerals">{formatCurrency(bookingStats.collected)}</strong>
            <span className="bookings-kpi__hint">{c.statCollectedHint}</span>
          </article>
          <article className="bookings-kpi bookings-kpi--slate">
            <span className="bookings-kpi__label">{c.statBooked}</span>
            <strong className="bookings-kpi__value western-numerals">{formatCurrency(bookingStats.booked)}</strong>
            <span className="bookings-kpi__hint">{c.statBookedHint}</span>
          </article>
          <article className="bookings-kpi bookings-kpi--rose">
            <span className="bookings-kpi__label">{c.statOutstanding}</span>
            <strong className="bookings-kpi__value western-numerals">{formatCurrency(bookingStats.outstanding)}</strong>
            <span className="bookings-kpi__hint">{c.statOutstandingHint}</span>
          </article>
          <article className="bookings-kpi bookings-kpi--muted">
            <span className="bookings-kpi__label">{c.statTotalInList}</span>
            <strong className="bookings-kpi__value western-numerals">{bookingStats.total}</strong>
            <span className="bookings-kpi__hint">
              {bookingStats.terminal} {language === 'en' ? 'closed / cancelled rows' : 'صفوف مغلقة أو ملغاة'}
            </span>
          </article>
        </section>
      </div>

      <div className="bookings-management">
        <div className="bookings-toolbar bookings-toolbar--hub" role="region" aria-label={c.filterTimeRange}>
          <div className="bookings-filters-card">
            <p className="bookings-filters-intro">{c.filtersCardHint}</p>
            <div className="bookings-filter-block">
              <div className="bookings-filter-block-head">
                <span className="bookings-filter-block-label">{c.filterTimeRange}</span>
              </div>
              <div className="bookings-tabs bookings-tabs--time bookings-tabs--hub" role="tablist" aria-label={c.filterTimeRange}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'upcoming'}
                  className={`bookings-tab ${filter === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setFilter('upcoming')}
                >
                  <span className="bookings-tab-title">{c.upcoming}</span>
                  <span className="bookings-tab-count western-numerals">{upcoming.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'past'}
                  className={`bookings-tab ${filter === 'past' ? 'active' : ''}`}
                  onClick={() => setFilter('past')}
                >
                  <span className="bookings-tab-title">{c.past}</span>
                  <span className="bookings-tab-count western-numerals">{past.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'deadline_expired'}
                  className={`bookings-tab ${filter === 'deadline_expired' ? 'active' : ''}`}
                  onClick={() => setFilter('deadline_expired')}
                >
                  <span className="bookings-tab-title">{c.deadlineExpiredTab}</span>
                  <span className="bookings-tab-count western-numerals">{deadlineExpired.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'member_cancelled'}
                  className={`bookings-tab ${filter === 'member_cancelled' ? 'active' : ''}`}
                  onClick={() => setFilter('member_cancelled')}
                >
                  <span className="bookings-tab-title">{c.memberCancelled}</span>
                  <span className="bookings-tab-count western-numerals">{memberCancelled.length}</span>
                </button>
              </div>
            </div>
            <div className="bookings-filter-block bookings-filter-block--type">
              <div className="bookings-type-strip" role="group" aria-label={c.filterByType}>
                <span className="bookings-type-strip-label">{c.filterByType}</span>
                {[
                  { id: 'all', label: c.filterAll, count: typeCounts.all },
                  { id: 'court', label: c.filterCourts, count: typeCounts.court },
                  { id: 'training', label: c.filterTraining, count: typeCounts.training },
                  { id: 'tournament', label: c.filterTournaments, count: typeCounts.tournament }
                ].map(chip => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`bookings-type-chip ${typeFilter === chip.id ? 'active' : ''}`}
                    onClick={() => setTypeFilter(chip.id)}
                  >
                    <span className="bookings-type-chip-label">{chip.label}</span>
                    <span className="bookings-type-chip-count western-numerals">{chip.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bookings-table cxp-card bookings-table--redesign bookings-table--hub-wrap">
          <table>
            <thead>
              <tr>
                <th>{c.date}</th>
                <th>{c.time}</th>
                <th>{c.typeCol}</th>
                <th>{c.court}</th>
                <th>{c.customer}</th>
                <th>{c.price}</th>
                <th>{c.status}</th>
                <th>{c.actions}</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan="8" className="bookings-empty-cell">
                    {c.noBookings}
                  </td>
                </tr>
              ) : (
                displayed.map((b, i) => {
                  const bookingKind = classifyAdminBooking(b)
                  const kindBadgeClass = bookingKind.replace(/_/g, '-')
                  const isTournamentRow = b.isTournament
                  const dur = b.durationMinutes || 60
                  const priceInfo = b.price != null
                    ? { price: b.price, currency: b.currency || club?.settings?.currency || 'SAR' }
                    : calculateBookingPrice(club, b.dateStr, b.startTime, dur)
                  const status = (b.status || 'confirmed').toString()
                  const rowAwaitingRefundAck = status === 'cancelled_awaiting_refund_ack'
                  const rowEnded = ['cancelled', 'expired'].includes(status)
                  const blockActions = rowEnded || rowAwaitingRefundAck
                  const statusLc = (status || '').toString().toLowerCase()
                  const statusNorm = statusLc.replace(/-/g, '_')
                  const bookingData = bookingJsonData(b)
                  const fulfilledRefund = !!(bookingData.clubRefundFulfilledAt || b.clubRefundFulfilledAt)
                  const refundFulfillment = String(
                    bookingData.clubRefundFulfillment || b.clubRefundFulfillment || ''
                  ).toLowerCase()
                  const memberRefundPendingFulfillment =
                    ['cancelled', 'canceled'].includes(statusNorm) &&
                    !fulfilledRefund &&
                    (hasMemberSelfCancelFlag(b) ||
                      !!(bookingData.memberRefundPreference || b.memberRefundPreference))
                  const noFinancialFollowUp =
                    isTerminalBookingStatus(status) &&
                    ['cancelled', 'expired', 'canceled'].includes(statusNorm) &&
                    !bookingHasCollectedPayment(b) &&
                    statusLc !== 'cancelled_awaiting_refund_ack' &&
                    !fulfilledRefund &&
                    !memberRefundPendingFulfillment
                  let actionsFulfilledNote = null
                  if (fulfilledRefund) {
                    if (refundFulfillment === 'wallet') actionsFulfilledNote = c.actionsRefundDoneWallet
                    else if (refundFulfillment === 'cash') actionsFulfilledNote = c.actionsRefundDoneCash
                    else if (refundFulfillment === 'electronic') actionsFulfilledNote = c.actionsRefundDoneElectronic
                    else actionsFulfilledNote = c.actionsRefundDoneOther
                  }
                  const isLoading = actionLoading === b.id || actionLoading === 'perm-' + b.id
                  const isPendingPayment = ['pending_payments', 'partially_paid'].includes(status)
                  const paymentShares = Array.isArray(b.paymentShares) ? b.paymentShares : []
                  const hasShares = paymentShares.length > 0
                  const currency = priceInfo.currency || club?.settings?.currency || 'SAR'
                  const dbTotalNum = parseFloat(b.totalAmount ?? b.total_amount)
                  const fallbackPrice = parseFloat(priceInfo.price)
                  const fallbackAmount = parseFloat(b.amount)
                  const totalAmount =
                    Number.isFinite(dbTotalNum) && dbTotalNum > 0.009
                      ? dbTotalNum
                      : Number.isFinite(fallbackPrice) && fallbackPrice > 0.009
                        ? fallbackPrice
                        : Number.isFinite(fallbackAmount) && fallbackAmount > 0.009
                          ? fallbackAmount
                          : 0
                  const shareOptsPanel = { tournamentData: club?.tournamentData }
                  const sharesEffectiveSum = hasShares
                    ? paymentShares
                        .filter((s) => shareRowIsActive(s))
                        .reduce((sum, s) => sum + effectiveShareAmount(b, s, shareOptsPanel), 0)
                    : 0
                  const paymentPanelTotal =
                    hasShares && sharesEffectiveSum > 0.009
                      ? Math.round(sharesEffectiveSum * 100) / 100
                      : totalAmount
                  const paidSumForPanel = effectiveSplitPaidSum(b, shareOptsPanel)
                  const remainingForPanel = Math.max(0, paymentPanelTotal - paidSumForPanel)
                  const incompleteSplit =
                    hasShares &&
                    paymentPanelTotal > 0 &&
                    paidSumForPanel < paymentPanelTotal - 0.01
                  const unpaidSplitExpired = statusLc === 'expired' && incompleteSplit
                  const showPaymentPanel =
                    rowAwaitingRefundAck ||
                    memberRefundPendingFulfillment ||
                    unpaidSplitExpired ||
                    (!rowEnded &&
                      (hasShares ||
                        isPendingPayment ||
                        (Number(totalAmount) > 0 &&
                          ['confirmed', 'partially_paid', 'pending_payments', 'pending_payment'].includes(status))))
                  const isExpanded = expandedPaymentId === b.id
                  const statusClass = ['confirmed'].includes(status)
                    ? 'confirmed'
                    : ['cancelled_awaiting_refund_ack'].includes(status)
                      ? 'refund-pending'
                      : ['initiated', 'locked', 'pending_payments', 'pending_payment', 'partially_paid'].includes(status)
                        ? 'pending'
                        : ['cancelled', 'expired'].includes(status)
                          ? 'cancelled'
                          : ''
                  return (
                    <React.Fragment key={b.id || i}>
                      <tr
                        id={b.id ? `admin-booking-row-${b.id}` : undefined}
                        className={[rowEnded ? 'booking-row-cancelled' : rowAwaitingRefundAck ? 'booking-row-awaiting-refund' : '', `booking-row--kind-${kindBadgeClass}`].filter(Boolean).join(' ')}
                      >
                        <td>{formatDate(b.dateStr)}</td>
                        <td className="bookings-cell-time">{(b.startTime || '') + (b.endTime ? ` – ${b.endTime}` : '')}</td>
                        <td>
                          <span className={`booking-kind-badge booking-kind-badge--${kindBadgeClass}`}>
                            {kindLabel(bookingKind)}
                          </span>
                        </td>
                        <td className="bookings-cell-resource">{formatBookingResource(b)}</td>
                        <td>{b.memberName || b.customerName || b.customer || '—'}</td>
                        <td className="bookings-cell-price">
                          {(() => {
                            const p = b.price != null ? b.price : (isTournamentRow && b.amount !== '' && b.amount != null ? b.amount : priceInfo.price)
                            if (p === '' || p == null || (typeof p === 'number' && Number.isNaN(p))) return '—'
                            return <>{p} {priceInfo.currency}</>
                          })()}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`booking-status-btn booking-status-${statusClass} ${showPaymentPanel ? 'booking-status-clickable' : ''}`}
                            onClick={() => {
                              if (!showPaymentPanel) return
                              if (!isExpanded) onRefresh?.()
                              setExpandedPaymentId(isExpanded ? null : b.id)
                            }}
                            title={showPaymentPanel ? c.clickToExpand : undefined}
                          >
                            <span className="booking-status-label">{getStatusLabel(status, b)}</span>
                            {showPaymentPanel && <span className="booking-status-chevron" aria-hidden>{isExpanded ? '▲' : '▼'}</span>}
                          </button>
                        </td>
                        <td>
                          {(actionsFulfilledNote || noFinancialFollowUp) && (
                            <p className="bookings-actions-note">
                              {actionsFulfilledNote || c.actionsNoRefundNeeded}
                            </p>
                          )}
                          {(!noFinancialFollowUp || actionsFulfilledNote) && (
                            <div className="bookings-actions">
                              <button
                                type="button"
                                className="btn-secondary btn-icon"
                                onClick={() => openEditModal(b)}
                                disabled={isLoading || isTournamentRow}
                                title={isTournamentRow ? c.editDisabledTournament : c.edit}
                              >
                                ✏️
                              </button>
                              {!blockActions && (b.dateStr || '') >= today && (
                                <button
                                  type="button"
                                  className="btn-warning btn-icon"
                                  onClick={() => handleCancel(b)}
                                  disabled={isLoading}
                                  title={c.cancel}
                                >
                                  ⛔
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-danger btn-icon"
                                onClick={() => handleDelete(b.id)}
                                disabled={isLoading}
                                title={c.delete}
                              >
                                🗑️
                              </button>
                              <button
                                type="button"
                                className="btn-danger-outline btn-icon"
                                onClick={() => handlePermanentDelete(b.id)}
                                disabled={isLoading}
                                title={c.permanentDelete}
                              >
                                ⚠️
                              </button>
                            </div>
                          )}
                        </td>
                    </tr>
                    {showPaymentPanel && isExpanded && (
                      <tr className="booking-payment-details-row">
                        <td colSpan="8">
                          <div className="booking-payment-details-card">
                            <h4 className="booking-payment-details-title">{c.paymentDetails}</h4>
                            <div className="booking-payment-details-grid">
                              <div className="booking-payment-detail-item">
                                <span className="booking-payment-detail-label">{c.paymentType}</span>
                                <span className="booking-payment-detail-value">
                                  {hasShares ? c.splitPayment : c.singlePayment}
                                </span>
                              </div>
                              {!hasShares && (
                                <div className="booking-payment-detail-item">
                                  <span className="booking-payment-detail-label">{c.paymentMethod}</span>
                                  <span className="booking-payment-detail-value">
                                    {getPaymentMethodLabel(
                                      b.initiatorPaymentMethod ||
                                        b.paymentMethod ||
                                        (b.data && typeof b.data === 'object'
                                          ? (b.data.initiatorPaymentMethod || b.data.paymentMethod)
                                          : undefined)
                                    )}
                                  </span>
                                </div>
                              )}
                              <div className="booking-payment-detail-item">
                                <span className="booking-payment-detail-label">{c.totalAmount}</span>
                                <span className="booking-payment-detail-value booking-payment-total">
                                  {paymentPanelTotal} {currency}
                                </span>
                              </div>
                              {hasShares && (
                                <>
                                  <div className="booking-payment-detail-item">
                                    <span className="booking-payment-detail-label">{c.collectedAmount}</span>
                                    <span className="booking-payment-detail-value">{paidSumForPanel.toFixed(2)} {currency}</span>
                                  </div>
                                  <div className="booking-payment-detail-item">
                                    <span className="booking-payment-detail-label">{c.remainingAmount}</span>
                                    <span className="booking-payment-detail-value">{remainingForPanel.toFixed(2)} {currency}</span>
                                  </div>
                                </>
                              )}
                            </div>
                            {unpaidSplitExpired ? (
                              <div className="booking-expired-split-extend">
                                <h5 className="booking-expired-split-extend__title">{c.expiredSplitBannerTitle}</h5>
                                <p className="booking-expired-split-extend__hint">{c.expiredSplitBannerHint}</p>
                                <div className="booking-expired-split-extend__row">
                                  <label className="booking-expired-split-extend__label" htmlFor={`extend-mins-${b.id}`}>
                                    {c.extendMinutesLabel}
                                  </label>
                                  <input
                                    id={`extend-mins-${b.id}`}
                                    type="number"
                                    min={1}
                                    max={43200}
                                    className="booking-expired-split-extend__input western-numerals"
                                    value={
                                      splitExtendMinutesDraft[b.id] != null
                                        ? splitExtendMinutesDraft[b.id]
                                        : String(club?.settings?.splitPaymentDeadlineMinutes ?? 30)
                                    }
                                    onChange={(e) =>
                                      setSplitExtendMinutesDraft((prev) => ({
                                        ...prev,
                                        [b.id]: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <p className="booking-expired-split-extend__meta">{c.extendMinutesHint}</p>
                                <div className="booking-expired-split-extend__presets">
                                  {[
                                    { v: 30, lab: c.extendPreset30 },
                                    { v: 60, lab: c.extendPreset1h },
                                    { v: 120, lab: c.extendPreset2h },
                                    { v: 1440, lab: c.extendPreset24h },
                                  ].map((p) => (
                                    <button
                                      key={p.v}
                                      type="button"
                                      className="booking-expired-split-extend__chip"
                                      onClick={() =>
                                        setSplitExtendMinutesDraft((prev) => ({ ...prev, [b.id]: String(p.v) }))
                                      }
                                    >
                                      {p.lab}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  className="booking-payment-mark-paid-btn booking-expired-split-extend__submit"
                                  disabled={actionLoading === 'extend-deadline-' + b.id}
                                  onClick={() => handleExtendExpiredSplitDeadline(b)}
                                >
                                  {actionLoading === 'extend-deadline-' + b.id ? '…' : c.extendSplitDeadlineBtn}
                                </button>
                                {paidSumForPanel > 0.01 ? (
                                  <div className="booking-expired-split-import">
                                    <p className="booking-expired-split-import__hint">{c.importExpiredPaidHint}</p>
                                    <button
                                      type="button"
                                      className="booking-payment-mark-paid-btn booking-expired-split-import__btn"
                                      disabled={actionLoading === `import-expired-${b.id}`}
                                      onClick={() => handleImportExpiredPaidToWallets(b)}
                                    >
                                      {actionLoading === `import-expired-${b.id}` ? '…' : c.importExpiredPaidToWallet}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {(() => {
                              const singleM = (
                                b.initiatorPaymentMethod ||
                                b.paymentMethod ||
                                (b.data && typeof b.data === 'object'
                                  ? (b.data.initiatorPaymentMethod || b.data.paymentMethod)
                                  : '') ||
                                ''
                              ).toString()
                              const isAtClubFullPending =
                                !hasShares &&
                                (status || '').toString() === 'pending_payment' &&
                                singleM.toLowerCase() === 'at_club'
                              if (!isAtClubFullPending) return null
                              return (
                                <div className="booking-atclub-confirm-bar" style={{ marginTop: 12 }}>
                                  <p className="booking-atclub-confirm-hint" style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#64748b' }}>
                                    {language === 'en'
                                      ? 'The booker will pay at the club. When you receive the money at the desk, confirm here to mark the booking paid and issue the invoice.'
                                      : 'الحاجز سيدفع في النادي. عند استلام المبلغ في الاستقبال، أكّد هنا لتسجيل الدفع وإصدار الفاتورة.'}
                                  </p>
                                  <button
                                    type="button"
                                    className="booking-payment-mark-paid-btn"
                                    disabled={actionLoading === 'confirm-atclub-' + b.id}
                                    onClick={() => handleConfirmPaidAtClubFull(b)}
                                  >
                                    {actionLoading === 'confirm-atclub-' + b.id
                                      ? '…'
                                      : language === 'en'
                                        ? 'Confirm payment received'
                                        : 'تأكيد استلام الدفع'}
                                  </button>
                                </div>
                              )
                            })()}
                            {(rowAwaitingRefundAck || memberRefundPendingFulfillment) &&
                              (isMemberCancelledBooking(b) || b.memberRefundPreference || bookingData.memberRefundPreference) && (
                              <div className="booking-member-refund-fulfill">
                                <h5 className="booking-member-refund-fulfill__title">
                                  {language === 'en' ? 'Member refund request' : 'طلب استرداد من العضو'}
                                </h5>
                                <p className="booking-member-refund-fulfill__meta">
                                  {language === 'en' ? 'Preference' : 'الخيار'}: <strong>{String(b.memberRefundPreference || '—')}</strong>
                                  {' · '}
                                  {language === 'en' ? 'Net' : 'الصافي'}: <strong>{b.memberRefundNet != null ? b.memberRefundNet : '—'} {currency}</strong>
                                </p>
                                <p className="booking-member-refund-fulfill__hint">
                                  {language === 'en'
                                    ? 'Choose how you completed the refund. For card payments, use Electronic after your bank reversal.'
                                    : 'اختر كيف نفّذت الاسترداد. للدفع بالبطاقة استخدم «إلكتروني» بعد عكس العملية لدى البنك.'}
                                </p>
                                <div className="booking-member-refund-fulfill__actions">
                                  <button
                                    type="button"
                                    className="booking-payment-mark-paid-btn"
                                    disabled={actionLoading === `fulfill-refund-${b.id}`}
                                    onClick={() => handleFulfillMemberRefund(b, 'cash')}
                                  >
                                    {actionLoading === `fulfill-refund-${b.id}` ? '…' : language === 'en' ? 'Paid cash to customer' : 'دفع نقداً للعميل'}
                                  </button>
                                  <button
                                    type="button"
                                    className="booking-payment-mark-paid-btn"
                                    disabled={actionLoading === `fulfill-refund-${b.id}`}
                                    onClick={() => handleFulfillMemberRefund(b, 'wallet')}
                                  >
                                    {language === 'en' ? 'Credited wallet' : 'إضافة للمحفظة'}
                                  </button>
                                  <button
                                    type="button"
                                    className="booking-refund-btn booking-refund-btn--warn"
                                    disabled={actionLoading === `fulfill-refund-${b.id}`}
                                    onClick={() => handleFulfillMemberRefund(b, 'electronic')}
                                  >
                                    {language === 'en' ? 'Electronic / bank refund' : 'استرداد إلكتروني / بنك'}
                                  </button>
                                </div>
                              </div>
                            )}
                            {hasShares && (
                              <div className="booking-payment-shares">
                                <div className="booking-payment-shares-head">
                                  <h5 className="booking-payment-shares-title">{c.amountPerParticipant}</h5>
                                  {isTournamentRow && !blockActions && (
                                    <button
                                      type="button"
                                      className="booking-payment-remove-all-tournament-btn"
                                      title={c.removeAllTournamentParticipantsTitle}
                                      onClick={() => handleRemoveAllTournamentParticipants(b)}
                                      disabled={actionLoading === `remove-all-tournament-shares-${b.id}`}
                                    >
                                      {actionLoading === `remove-all-tournament-shares-${b.id}`
                                        ? '…'
                                        : c.removeAllTournamentParticipants}
                                    </button>
                                  )}
                                </div>
                                <div className="booking-payment-shares-list">
                                  {(() => {
                                    const shareOpts = shareOptsPanel
                                    const bookerId = String(b.memberId || b.initiatorMemberId || b.member_id || '')
                                    const isBookerShare = (s) => String(s.memberId || s.member_id || '') === bookerId
                                    const bookerShares = paymentShares.filter(s => isBookerShare(s) && !s.inviteToken && !s.invite_token)
                                    const participantShares = paymentShares.filter(s => !isBookerShare(s) || !!s.inviteToken || !!s.invite_token)
                                    const bookerAmountFromCalc = Math.max(0, paymentPanelTotal - sharesEffectiveSum)
                                    const bookerPaymentMethod = b.initiatorPaymentMethod || b.paymentMethod
                                    const renderShareRow = (s, idx, isBooker) => {
                                      const isRefunded = !!s.refundedAt
                                      const isRemoved = !!s.removedAt
                                      const canMarkPaid = !isRefunded && !isRemoved && !s.paidAt && s.paymentMethod === 'at_club' && (s.id || s.inviteToken)
                                      const memberRefundPending = shareHasMemberRefundPending(s, b)
                                      const memberRefundPref = s.memberRefundRoute || s.member_refund_route || '—'
                                      const memberRefundNetVal =
                                        s.memberRefundNet != null ? s.memberRefundNet : s.member_refund_net
                                      const removeShareKey = `remove-share-${s.id || s.inviteToken || idx}`
                                      const phoneDigShare = String(s.phone || '').replace(/\D/g, '')
                                      const waShareKey = `wa-share-${s.id || s.inviteToken || phoneDigShare || idx}`
                                      const sharePaidForRemove =
                                        !!(s.paidAt || s.paid_at) &&
                                        !(s.refundedAt || s.refunded_at) &&
                                        !(s.removedAt || s.removed_at)
                                      const canAdminRemoveShare =
                                        !isRemoved &&
                                        !isRefunded &&
                                        !memberRefundPending &&
                                        !!(s.id || s.inviteToken || s.invite_token)
                                      const effectiveAmt = effectiveShareAmount(b, s, shareOpts)
                                      const canResendTournamentWa =
                                        isTournamentRow &&
                                        !isRemoved &&
                                        !isRefunded &&
                                        !s.paidAt &&
                                        !memberRefundPending &&
                                        phoneDigShare.length >= 8 &&
                                        effectiveAmt > 0.009
                                      return (
                                        <div key={s.id || idx} className={`booking-payment-share-item ${isRemoved ? 'share-removed' : memberRefundPending ? 'share-member-refund-pending' : s.paidAt ? 'paid' : 'pending'}`}>
                                          <div className="booking-payment-share-top">
                                            <span className="booking-payment-share-name">
                                              {resolvePaymentShareDisplayName(s, members)}{isBooker ? ` (${c.booker})` : ''}
                                            </span>
                                            <span className="booking-payment-share-amount">
                                              {(isRemoved ? shareAmountRaw(s) : effectiveShareAmount(b, s, shareOpts))}{' '}
                                              {currency}
                                            </span>
                                            <span className="booking-payment-share-status">
                                              {isRemoved ? (
                                                <span className="status-badge status-removed">{c.removedParticipant}</span>
                                              ) : isRefunded ? (
                                                <span className="status-badge status-refunded">{c.refunded}</span>
                                              ) : memberRefundPending && s.paidAt ? (
                                                <span className="status-badge status-member-refund-pending">{c.shareRefundPendingBadge}</span>
                                              ) : s.paidAt ? (
                                                s.paymentMethod === 'at_club' ? (
                                                  <span className="status-badge status-pay-at-club">✓ {c.payAtClub}</span>
                                                ) : (
                                                  <span className="status-badge status-paid">✓ {c.paid}</span>
                                                )
                                              ) : s.paymentMethod === 'at_club' ? (
                                                <span className="status-badge status-pay-at-club">{c.waitingClubConfirm}</span>
                                              ) : s.paymentMethod ? (
                                                <span className="status-badge status-booker-method">{getPaymentMethodLabel(s.paymentMethod)}</span>
                                              ) : (
                                                <span className="status-badge status-pending">{c.pending}</span>
                                              )}
                                            </span>
                                            {(canMarkPaid || canAdminRemoveShare || canResendTournamentWa) && (
                                              <div className="booking-payment-share-actions">
                                                {canMarkPaid && (
                                                  <button
                                                    type="button"
                                                    className="booking-payment-mark-paid-btn"
                                                    onClick={() => handleMarkSharePaidAtClub(s)}
                                                    disabled={actionLoading === `share-${s.id}`}
                                                  >
                                                    {actionLoading === `share-${s.id}` ? '…' : (language === 'en' ? 'Mark paid' : 'تسجيل الدفع')}
                                                  </button>
                                                )}
                                                {canResendTournamentWa && (
                                                  <button
                                                    type="button"
                                                    className="booking-payment-share-wa-btn"
                                                    title={c.resendTournamentWhatsAppTitle}
                                                    aria-label={c.resendTournamentWhatsAppTitle}
                                                    onClick={() => handleResendTournamentShareWhatsApp(b, s)}
                                                    disabled={actionLoading === waShareKey}
                                                  >
                                                    {actionLoading === waShareKey ? '…' : c.resendTournamentWhatsApp}
                                                  </button>
                                                )}
                                                {canAdminRemoveShare && (
                                                  <button
                                                    type="button"
                                                    className="booking-payment-share-remove-btn"
                                                    title={sharePaidForRemove ? c.removePaidParticipantTitle : c.removeParticipantTitle}
                                                    aria-label={sharePaidForRemove ? c.removePaidParticipantTitle : c.removeParticipantTitle}
                                                    onClick={() => handleAdminRemoveParticipantShare(b, s)}
                                                    disabled={actionLoading === removeShareKey}
                                                  >
                                                    {actionLoading === removeShareKey
                                                      ? '…'
                                                      : sharePaidForRemove
                                                        ? c.removePaidParticipant
                                                        : c.removeParticipant}
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          {isRefunded && (
                                            <div className="booking-refund-meta">
                                              <span>{getPaymentMethodLabel(s.paymentMethod)} → {s.refundMethod || '—'}</span>
                                              {s.refundReference ? <span className="booking-refund-ref">{c.refundRef}: {s.refundReference}</span> : null}
                                              {s.refundAcknowledgedAt ? (
                                                <span className="booking-refund-ack ok">✓ {c.refundAckDone}</span>
                                              ) : (
                                                <span className="booking-refund-ack pending">⏳ {c.payerConfirmPending}</span>
                                              )}
                                            </div>
                                          )}
                                          {memberRefundPending && (
                                            <div className="booking-member-share-refund-banner" role="status">
                                              <p className="booking-member-share-refund-banner-text">
                                                {language === 'en'
                                                  ? `Member refund request: ${memberRefundPref} — net ${memberRefundNetVal != null ? memberRefundNetVal : '—'} ${currency}. Complete using the member’s chosen channel or yours.`
                                                  : `طلب استرداد من المشارك: ${memberRefundPref} — صافي ${memberRefundNetVal != null ? memberRefundNetVal : '—'} ${currency}. نفّذ حسب اختيار العضو أو قناتك.`}
                                              </p>
                                              {s.id ? (
                                                <div className="booking-member-share-refund-actions">
                                                  <button
                                                    type="button"
                                                    className="booking-payment-mark-paid-btn"
                                                    disabled={actionLoading === `fulfill-share-refund-${s.id}`}
                                                    onClick={() => handleFulfillMemberShareRefund(s.id, 'cash')}
                                                  >
                                                    {actionLoading === `fulfill-share-refund-${s.id}` ? '…' : language === 'en' ? 'Cash done' : 'تم النقد'}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="booking-payment-mark-paid-btn"
                                                    disabled={actionLoading === `fulfill-share-refund-${s.id}`}
                                                    onClick={() => handleFulfillMemberShareRefund(s.id, 'wallet')}
                                                  >
                                                    {language === 'en' ? 'Wallet credit' : 'محفظة'}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="booking-refund-btn booking-refund-btn--warn"
                                                    disabled={actionLoading === `fulfill-share-refund-${s.id}`}
                                                    onClick={() => handleFulfillMemberShareRefund(s.id, 'electronic')}
                                                  >
                                                    {language === 'en' ? 'Electronic' : 'إلكتروني'}
                                                  </button>
                                                </div>
                                              ) : (
                                                <p className="booking-member-share-refund-banner-footnote">
                                                  {language === 'en'
                                                    ? 'Refresh data or open this booking again if fulfillment buttons are missing (share id required).'
                                                    : 'حدّث الصفحة أو أعد فتح الحجز إذا لم تظهر أزرار التنفيذ — يجب أن تتوفر معرفة الحصة.'}
                                                </p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    }
                                    return (
                                      <>
                                        {bookerShares.length > 0 ? bookerShares.map((s, idx) => renderShareRow(s, idx, true)) : (
                                          bookerAmountFromCalc > 0 && (
                                            <div className="booking-payment-share-item booker-share">
                                              <span className="booking-payment-share-name">{b.memberName || b.customerName || b.customer || '—'} ({c.booker})</span>
                                              <span className="booking-payment-share-amount">{bookerAmountFromCalc} {currency}</span>
                                              <span className="booking-payment-share-status">
                                                {bookerPaymentMethod === 'at_club' ? (
                                                  <span className="status-badge status-pay-at-club">{c.waitingClubConfirm}</span>
                                                ) : bookerPaymentMethod ? (
                                                  <span className="status-badge status-booker-method">{getPaymentMethodLabel(bookerPaymentMethod)}</span>
                                                ) : (
                                                  <span className="status-badge status-pending">—</span>
                                                )}
                                              </span>
                                            </div>
                                          )
                                        )}
                                        {participantShares.map((s, idx) => renderShareRow(s, idx, false))}
                                      </>
                                    )
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editBooking && (
        <div className="bookings-edit-overlay" onClick={() => setEditBooking(null)}>
          <div className="bookings-edit-modal" onClick={e => e.stopPropagation()}>
            <h3>{c.editBooking}</h3>
            <div className="bookings-edit-form">
              <div className="form-row">
                <label>{c.date}</label>
                <CalendarPicker
                  value={editForm.dateStr}
                  onChange={v => setEditForm(f => ({ ...f, dateStr: v }))}
                  language={language}
                />
              </div>
              <div className="form-row">
                <label>{c.time}</label>
                <HalfHourTimeSelect
                  value={editForm.startTime}
                  onChange={v => setEditForm(f => ({ ...f, startTime: v }))}
                  settings={club?.settings}
                  isoDate={editForm.dateStr}
                />
              </div>
              <div className="form-row">
                <label>{c.duration}</label>
                <input
                  type="number"
                  min="30"
                  step="30"
                  value={editForm.durationMinutes}
                  onChange={e => setEditForm(f => ({ ...f, durationMinutes: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <label>{c.court}</label>
                {courts.length > 0 ? (
                  <select
                    value={editForm.courtId || '_other'}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '_other') {
                        setEditForm(f => ({ ...f, courtId: '', resource: f.resource }))
                      } else {
                        const court = courts.find(c => c.id === val)
                        setEditForm(f => ({ ...f, courtId: val, resource: court?.name || val }))
                      }
                    }}
                  >
                    {courts.map(court => (
                      <option key={court.id} value={court.id}>{court.name || court.id}</option>
                    ))}
                    <option value="_other">— {language === 'en' ? 'Other' : 'آخر'} —</option>
                  </select>
                ) : null}
                {(courts.length === 0 || editForm.courtId === '' || editForm.courtId === '_other') && (
                  <input
                    type="text"
                    value={editForm.resource}
                    onChange={e => setEditForm(f => ({ ...f, resource: e.target.value }))}
                    placeholder={c.court}
                  />
                )}
              </div>
              <div className="form-row">
                <label>{c.customer}</label>
                {members.length > 0 ? (
                  <select
                    value={members.some(m => String(m.id) === editForm.memberId) ? editForm.memberId : '_other'}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '_other') {
                        setEditForm(f => ({ ...f, memberId: '', memberName: f.memberName || '' }))
                      } else {
                        const m = members.find(x => String(x.id) === val)
                        setEditForm(f => ({ ...f, memberId: val, memberName: m?.name || m?.email || val }))
                      }
                    }}
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
                    ))}
                    <option value="_other">— {language === 'en' ? 'Other' : 'آخر'} —</option>
                  </select>
                ) : null}
                <input
                  type="text"
                  value={editForm.memberName}
                  onChange={e => setEditForm(f => ({ ...f, memberName: e.target.value }))}
                  placeholder={c.customer}
                />
              </div>
              <div className="form-row">
                <label>{c.price}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.price}
                  onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                />
                <span>{club?.settings?.currency || 'SAR'}</span>
              </div>
              <div className="form-row">
                <label>{c.status}</label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                >
                  <option value="confirmed">{getStatusLabel('confirmed')}</option>
                  <option value="pending_payments">{getStatusLabel('pending_payments')}</option>
                  <option value="partially_paid">{getStatusLabel('partially_paid')}</option>
                  <option value="pending_payment">{getStatusLabel('pending_payment')}</option>
                  <option value="cancelled">{getStatusLabel('cancelled')}</option>
                  <option value="cancelled_awaiting_refund_ack">{getStatusLabel('cancelled_awaiting_refund_ack')}</option>
                  <option value="expired">{getStatusLabel('expired')}</option>
                </select>
              </div>
            </div>
            <div className="bookings-edit-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditBooking(null)}>
                {c.close}
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveEdit} disabled={actionLoading === 'edit'}>
                {actionLoading === 'edit' ? '…' : c.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClubBookingsManagement
