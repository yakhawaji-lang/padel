import React, { useState, useEffect, useMemo } from 'react'
import { loadClubs, getClubById, getClubMembersFromStorage, getAllMembersFromStorage, deleteBookingFromClub, updateBookingInClub } from '../../storage/adminStorage'
import { resolvePaymentShareDisplayName } from '../../utils/paymentShareMemberMatch'
import * as bookingApi from '../../api/dbClient'
import CalendarPicker from '../../components/CalendarPicker'
import { calculateBookingPrice } from '../../utils/bookingPricing'
import './club-pages-common.css'
import './BookingsManagement.css'

const TERMINAL_BOOKING_STATUSES = ['cancelled', 'expired', 'cancelled_awaiting_refund_ack']

function isTerminalBookingStatus(status) {
  return TERMINAL_BOOKING_STATUSES.includes((status || '').toString().toLowerCase())
}

/** حجز ألغاه العضو (مسار الاسترداد/الإلغاء الذاتي أو deleted_by = العضو) */
function isMemberCancelledBooking(b) {
  if (!isTerminalBookingStatus(b?.status)) return false
  if (b?.memberSelfCancel) return true
  const mid = String(b?.memberId || b?.initiatorMemberId || '').trim()
  const db = String(b?.deletedBy || '').trim()
  return !!(mid && db && db === mid)
}

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

const ClubBookingsManagement = ({ club, language, onRefresh }) => {
  const [bookings, setBookings] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [typeFilter, setTypeFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState(null)
  const [editBooking, setEditBooking] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [expandedPaymentId, setExpandedPaymentId] = useState(null)
  const [refundDraftByShareId, setRefundDraftByShareId] = useState({})
  const [fullRefundDraft, setFullRefundDraft] = useState({})

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
  const { upcoming, past, memberCancelled, displayed, typeCounts } = useMemo(() => {
    const withDate = bookings.map(b => ({
      ...b,
      dateStr: (b.date || b.startDate || '').toString().split('T')[0]
    }))
    const upcomingL = withDate.filter(
      b => !isTerminalBookingStatus(b.status) && (b.dateStr || '') >= today
    )
    const pastL = withDate.filter(b => (b.dateStr || '') < today)
    const memberCancelled = [...withDate.filter(b => isMemberCancelledBooking(b))].sort((a, b) =>
      String(b.dateStr || '').localeCompare(String(a.dateStr || ''))
    )
    const timeList =
      filter === 'upcoming' ? upcomingL : filter === 'past' ? pastL : memberCancelled
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
    return { upcoming: upcomingL, past: pastL, memberCancelled, displayed: disp, typeCounts: counts }
  }, [bookings, filter, typeFilter, today])

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

  const handleAdminRefundShare = async (share, bookingId, { removeFromBooking }) => {
    const draft = refundDraftByShareId[String(share.id || share.inviteToken || '')] || {}
    const refundMethod = draft.method || 'cash'
    const refundReference = (draft.reference || '').trim() || undefined
    const refundNotes = (draft.notes || '').trim() || undefined
    if (!club?.id || !bookingId) return
    const key = `refund-${share.id || share.inviteToken}`
    setActionLoading(key)
    try {
      await bookingApi.adminRefundShare({
        shareId: share.id || undefined,
        inviteToken: share.inviteToken || undefined,
        clubId: club.id,
        refundMethod,
        refundReference,
        refundNotes,
        removeFromBooking: !!removeFromBooking
      })
      refreshFromServer()
    } catch (e) {
      window.alert(language === 'en' ? (e?.message || 'Refund failed') : (e?.message || 'فشل الاسترداد'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleAdminRefundFull = async (bookingId) => {
    if (!club?.id || !bookingId) return
    const draft = fullRefundDraft[bookingId] || {}
    if (!window.confirm(language === 'en'
      ? 'Refund all paid participants and cancel the booking? Payers will confirm receipt in the app.'
      : 'استرداد المدفوع لجميع المشاركين وإلغاء الحجز؟ سيؤكد الدافعون الاستلام من التطبيق.')) return
    setActionLoading('full-refund-' + bookingId)
    try {
      await bookingApi.adminRefundBookingFull({
        bookingId,
        clubId: club.id,
        refundMethod: draft.method || 'cash',
        refundReference: (draft.reference || '').trim() || undefined,
        refundNotes: (draft.notes || '').trim() || undefined
      })
      refreshFromServer()
    } catch (e) {
      window.alert(language === 'en' ? (e?.message || 'Failed') : (e?.message || 'فشل'))
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
              ? `Invoice ${invNo} was created. A WhatsApp message was copied — paste it to send to the member.`
              : `أُنشئت الفاتورة ${invNo}. تم نسخ رسالة واتساب — الصقها لإرسالها للعضو.`
          )
        } catch {
          window.alert(language === 'en' ? `Invoice ${invNo} was created.` : `أُنشئت الفاتورة ${invNo}.`)
        }
      } else if (invNo) {
        window.alert(language === 'en' ? `Invoice ${invNo} was created.` : `أُنشئت الفاتورة ${invNo}.`)
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
        byMember: 'Member cancelled'
      },
      ar: {
        initiated: 'قيد الإجراء', locked: 'محجوز', pending_payments: 'بانتظار الدفعات', pending_payment: 'بانتظار الدفع', partially_paid: 'دفع جزئي', confirmed: 'مؤكد',
        cancelled: 'ملغي', expired: 'منتهي', cancelled_awaiting_refund_ack: 'ملغي — بانتظار تأكيد الاسترداد',
        byMember: 'ملغي من العضو'
      }
    }
    const L = labels[language] || labels.en
    const base = L[s] || status
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
        cash: 'Cash', pos: 'POS', stripe_manual: 'Stripe (manual)', electronic_reverse: 'Electronic reversal', other: 'Other'
      },
      ar: {
        at_club: 'في النادي', credit_card: 'بطاقة ائتمان', mada: 'مدى', electronic: 'إلكتروني',
        cash: 'نقد', pos: 'شبكة', stripe_manual: 'Stripe يدوي', electronic_reverse: 'عكس إلكتروني', other: 'أخرى'
      }
    }
    return (labels[language] || labels.en)[m] || m
  }

  const t = {
    en: {
      bookings: 'Bookings',
      pageSubtitle: 'Court rentals, training sessions, and tournaments in one place.',
      upcoming: 'Upcoming',
      past: 'Past',
      memberCancelled: 'Cancelled by member',
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
      amountPerParticipant: 'Amount per participant',
      participant: 'Participant',
      amount: 'Amount',
      paid: 'Paid',
      payAtClub: 'Pay at club',
      waitingClubConfirm: 'Waiting for club confirmation',
      booker: 'Booker',
      pending: 'Pending',
      clickToExpand: 'Click to view payment details',
      refundHow: 'Refund channel',
      refundRef: 'Reference / receipt',
      refundNotesPh: 'Internal notes',
      recordRefund: 'Record refund',
      refundAndRemove: 'Refund & remove from split',
      refundAll: 'Refund all & cancel booking',
      refunded: 'Refunded',
      removedParticipant: 'Removed',
      payerConfirmPending: 'Awaiting payer confirmation',
      stripeManualHint: 'Process the reversal in Stripe dashboard, then enter the refund ID above.',
      electronicHint: 'For card/Mada, process reversal in your gateway and note the reference.',
      refundAckDone: 'Participant confirmed receipt',
      editDisabledTournament: 'Edit tournament blocks from the tournament section of the club app.'
    },
    ar: {
      bookings: 'الحجوزات',
      pageSubtitle: 'حجوزات الملاعب والحصص التدريبية والبطولات في مكان واحد.',
      upcoming: 'القادمة',
      past: 'السابقة',
      memberCancelled: 'ملغاة من العضو',
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
      amountPerParticipant: 'المطلوب من كل مشارك',
      participant: 'المشارك',
      amount: 'المبلغ',
      paid: 'مدفوع',
      payAtClub: 'سيدفع في النادي',
      waitingClubConfirm: 'بانتظار التأكيد من النادي',
      booker: 'الحاجز',
      pending: 'قيد الانتظار',
      clickToExpand: 'انقر لعرض تفاصيل الدفع',
      refundHow: 'قناة الاسترداد',
      refundRef: 'مرجع / إيصال',
      refundNotesPh: 'ملاحظات داخلية',
      recordRefund: 'تسجيل الاسترداد',
      refundAndRemove: 'استرداد وإزالة من التقسيم',
      refundAll: 'استرداد الجميع وإلغاء الحجز',
      refunded: 'مسترد',
      removedParticipant: 'مُزال',
      payerConfirmPending: 'بانتظار تأكيد المسترد',
      stripeManualHint: 'نفّذ الاسترداد من لوحة Stripe ثم أدخل رقم الاسترداد أعلاه.',
      electronicHint: 'لبطاقة/مدى، نفّذ العكس من بوابة الدفع وسجّل المرجع.',
      refundAckDone: 'أكد المشارك الاستلام',
      editDisabledTournament: 'عدّل مواعيد البطولة من قسم البطولات في تطبيق النادي.'
    }
  }
  const c = t[language] || t.en

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

  if (!club) return null

  return (
    <div className="club-admin-page">
      <header className="cxp-header">
        <div className="cxp-header-title-wrap">
          <h1 className="cxp-title">
            {club.logo && <img src={club.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} />}
            {c.bookings} — {language === 'ar' ? (club.nameAr || club.name) : club.name}
          </h1>
          <p className="cxp-subtitle">{c.pageSubtitle}</p>
        </div>
        <div className="cxp-header-actions">
          <button type="button" className="cxp-btn cxp-btn--secondary" onClick={refreshFromServer}>
            ↻ {c.refresh}
          </button>
        </div>
      </header>

      <div className="bookings-management">
        <div className="bookings-toolbar">
          <div className="bookings-tabs bookings-tabs--time">
            <button
              type="button"
              className={`bookings-tab ${filter === 'upcoming' ? 'active' : ''}`}
              onClick={() => setFilter('upcoming')}
            >
              {c.upcoming} ({upcoming.length})
            </button>
            <button
              type="button"
              className={`bookings-tab ${filter === 'past' ? 'active' : ''}`}
              onClick={() => setFilter('past')}
            >
              {c.past} ({past.length})
            </button>
            <button
              type="button"
              className={`bookings-tab ${filter === 'member_cancelled' ? 'active' : ''}`}
              onClick={() => setFilter('member_cancelled')}
            >
              {c.memberCancelled} ({memberCancelled.length})
            </button>
          </div>
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
                <span className="bookings-type-chip-count">{chip.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bookings-table cxp-card bookings-table--redesign" style={{ overflow: 'hidden', padding: 0 }}>
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
                  const isLoading = actionLoading === b.id || actionLoading === 'perm-' + b.id
                  const isPendingPayment = ['pending_payments', 'partially_paid'].includes(status)
                  const paymentShares = Array.isArray(b.paymentShares) ? b.paymentShares : []
                  const hasShares = paymentShares.length > 0
                  const currency = priceInfo.currency || club?.settings?.currency || 'SAR'
                  const totalAmount = b.totalAmount ?? b.total_amount ?? priceInfo.price ?? 0
                  const showPaymentPanel = rowAwaitingRefundAck || (
                    !rowEnded && (
                      hasShares ||
                      isPendingPayment ||
                      (Number(totalAmount) > 0 && ['confirmed', 'partially_paid', 'pending_payments', 'pending_payment'].includes(status))
                    )
                  )
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
                      <tr className={[rowEnded ? 'booking-row-cancelled' : rowAwaitingRefundAck ? 'booking-row-awaiting-refund' : '', `booking-row--kind-${kindBadgeClass}`].filter(Boolean).join(' ')}>
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
                                  {totalAmount} {currency}
                                </span>
                              </div>
                            </div>
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
                            {hasShares && (
                              <div className="booking-payment-shares">
                                <h5 className="booking-payment-shares-title">{c.amountPerParticipant}</h5>
                                <div className="booking-payment-shares-list">
                                  {(() => {
                                    const bookerId = String(b.memberId || b.initiatorMemberId || b.member_id || '')
                                    const isBookerShare = (s) => String(s.memberId || '') === bookerId
                                    const bookerShares = paymentShares.filter(s => isBookerShare(s) && !s.inviteToken)
                                    const participantShares = paymentShares.filter(s => !isBookerShare(s) || !!s.inviteToken)
                                    const sharesSum = paymentShares.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
                                    const bookerAmountFromCalc = Math.max(0, totalAmount - sharesSum)
                                    const bookerPaymentMethod = b.initiatorPaymentMethod || b.paymentMethod
                                    const renderShareRow = (s, idx, isBooker) => {
                                      const shareKey = String(s.id || s.inviteToken || `i${idx}`)
                                      const draft = refundDraftByShareId[shareKey] || { method: 'cash' }
                                      const isRefunded = !!s.refundedAt
                                      const isRemoved = !!s.removedAt
                                      const canMarkPaid = !isRefunded && !isRemoved && !s.paidAt && s.paymentMethod === 'at_club' && (s.id || s.inviteToken)
                                      const refundChannelHint = draft.method === 'stripe_manual' ? c.stripeManualHint : draft.method === 'electronic_reverse' ? c.electronicHint : ''
                                      const canRefund = !!s.id && !!s.paidAt && !isRefunded && !isRemoved && !rowAwaitingRefundAck
                                      return (
                                        <div key={s.id || idx} className={`booking-payment-share-item ${isRemoved ? 'share-removed' : s.paidAt ? 'paid' : 'pending'}`}>
                                          <div className="booking-payment-share-top">
                                            <span className="booking-payment-share-name">
                                              {resolvePaymentShareDisplayName(s, members)}{isBooker ? ` (${c.booker})` : ''}
                                            </span>
                                            <span className="booking-payment-share-amount">{parseFloat(s.amount) || 0} {currency}</span>
                                            <span className="booking-payment-share-status">
                                              {isRemoved ? (
                                                <span className="status-badge status-removed">{c.removedParticipant}</span>
                                              ) : isRefunded ? (
                                                <span className="status-badge status-refunded">{c.refunded}</span>
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
                                          </div>
                                          {isRefunded && (
                                            <div className="booking-refund-meta">
                                              <span>{getPaymentMethodLabel(s.paymentMethod)} → {s.refundMethod || '—'}</span>
                                              {s.refundReference ? <span className="booking-refund-ref">{s.refundReference}</span> : null}
                                              {s.refundAcknowledgedAt ? (
                                                <span className="booking-refund-ack ok">✓ {c.refundAckDone}</span>
                                              ) : (
                                                <span className="booking-refund-ack pending">⏳ {c.payerConfirmPending}</span>
                                              )}
                                            </div>
                                          )}
                                          {canRefund && (
                                            <div className="booking-refund-controls">
                                              <label className="booking-refund-label">{c.refundHow}</label>
                                              <select
                                                className="booking-refund-select"
                                                value={draft.method || 'cash'}
                                                onChange={(e) => setRefundDraftByShareId((prev) => ({
                                                  ...prev,
                                                  [shareKey]: { ...draft, method: e.target.value }
                                                }))}
                                              >
                                                <option value="cash">{language === 'en' ? 'Cash at club' : 'نقد في النادي'}</option>
                                                <option value="pos">{language === 'en' ? 'POS / terminal' : 'شبكة / POS'}</option>
                                                <option value="stripe_manual">Stripe ({language === 'en' ? 'manual' : 'يدوي'})</option>
                                                <option value="electronic_reverse">{language === 'en' ? 'Electronic reversal' : 'عكس إلكتروني'}</option>
                                                <option value="other">{language === 'en' ? 'Other' : 'أخرى'}</option>
                                              </select>
                                              <input
                                                className="booking-refund-input"
                                                type="text"
                                                placeholder={c.refundRef}
                                                value={draft.reference || ''}
                                                onChange={(e) => setRefundDraftByShareId((prev) => ({
                                                  ...prev,
                                                  [shareKey]: { ...draft, reference: e.target.value }
                                                }))}
                                              />
                                              <input
                                                className="booking-refund-input"
                                                type="text"
                                                placeholder={c.refundNotesPh}
                                                value={draft.notes || ''}
                                                onChange={(e) => setRefundDraftByShareId((prev) => ({
                                                  ...prev,
                                                  [shareKey]: { ...draft, notes: e.target.value }
                                                }))}
                                              />
                                              {refundChannelHint ? <p className="booking-refund-hint">{refundChannelHint}</p> : null}
                                              <div className="booking-refund-actions">
                                                <button
                                                  type="button"
                                                  className="booking-refund-btn booking-refund-br"
                                                  disabled={actionLoading === `refund-${s.id || s.inviteToken}`}
                                                  onClick={() => handleAdminRefundShare(s, b.id, { removeFromBooking: false })}
                                                >
                                                  {c.recordRefund}
                                                </button>
                                                <button
                                                  type="button"
                                                  className="booking-refund-btn booking-refund-btn--warn"
                                                  disabled={actionLoading === `refund-${s.id || s.inviteToken}`}
                                                  onClick={() => handleAdminRefundShare(s, b.id, { removeFromBooking: true })}
                                                >
                                                  {c.refundAndRemove}
                                                </button>
                                              </div>
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
                                        {participantShares.map((s, idx) => renderShareRow(s, idx, String(s.memberId || '') === bookerId))}
                                      </>
                                    )
                                  })()}
                                </div>
                              </div>
                            )}
                            {hasShares && !rowAwaitingRefundAck && !rowEnded && (
                              <div className="booking-full-refund-card">
                                <h5 className="booking-full-refund-title">{c.refundAll}</h5>
                                <p className="booking-full-refund-desc">{language === 'en' ? 'Marks every paid share as refunded and removes unpaid invites. Booking becomes cancelled until each payer confirms in the app.' : 'يُسجَّل الاسترداد لكل من دفع ويُزال المدعوون غير المدفوع. يصبح الحجز ملغياً حتى يؤكد كل دافع في التطبيق.'}</p>
                                <div className="booking-refund-controls booking-refund-controls--full">
                                  <select
                                    className="booking-refund-select"
                                    value={(fullRefundDraft[b.id] || {}).method || 'cash'}
                                    onChange={(e) => setFullRefundDraft((prev) => ({
                                      ...prev,
                                      [b.id]: { ...(prev[b.id] || {}), method: e.target.value }
                                    }))}
                                  >
                                    <option value="cash">{language === 'en' ? 'Cash at club' : 'نقد في النادي'}</option>
                                    <option value="pos">{language === 'en' ? 'POS / terminal' : 'شبكة / POS'}</option>
                                    <option value="stripe_manual">Stripe ({language === 'en' ? 'manual' : 'يدوي'})</option>
                                    <option value="electronic_reverse">{language === 'en' ? 'Electronic reversal' : 'عكس إلكتروني'}</option>
                                    <option value="other">{language === 'en' ? 'Other' : 'أخرى'}</option>
                                  </select>
                                  <input
                                    className="booking-refund-input"
                                    type="text"
                                    placeholder={c.refundRef}
                                    value={(fullRefundDraft[b.id] || {}).reference || ''}
                                    onChange={(e) => setFullRefundDraft((prev) => ({
                                      ...prev,
                                      [b.id]: { ...(prev[b.id] || {}), reference: e.target.value }
                                    }))}
                                  />
                                  <button
                                    type="button"
                                    className="booking-full-refund-submit"
                                    disabled={actionLoading === 'full-refund-' + b.id}
                                    onClick={() => handleAdminRefundFull(b.id)}
                                  >
                                    {actionLoading === 'full-refund-' + b.id ? '…' : c.refundAll}
                                  </button>
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
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))}
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
