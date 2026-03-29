/**
 * Modal لتعديل الحجز، استكمال الدفع، مشاركة الحجز، إرسال رابط الخريطة، ومتابعة الدفع
 */
import React, { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import * as bookingApi from '../api/dbClient'
import MemberBookingActionsModal from './MemberBookingActionsModal'
import {
  resolvePaymentShareDisplayName,
  shareNeedsRefundAcknowledgment,
  findPaymentShareForMember,
  isSamePaymentShare,
  sharePaymentAllowsElectronicRefund,
} from '../utils/paymentShareMemberMatch'
import { normalizePhone } from '../utils/phoneNormalize'
import { buildPayShareAbsoluteUrl, buildWhatsAppHrefForSplitInvite } from '../utils/splitInviteLinks'
import { getTournamentMemberPaymentEntry } from '../utils/tournamentHelpers'
import { updateTournamentMemberPaymentEntry, withdrawMemberFromTournament } from '../storage/adminStorage'
import './BookingDetailModal.css'

function getMapUrl(club) {
  const addr = club?.address || club?.addressAr || club?.location?.address || ''
  const lat = club?.location?.lat
  const lng = club?.location?.lng
  if (lat != null && lng != null) {
    return `https://www.google.com/maps?q=${lat},${lng}`
  }
  if (addr && addr.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr.trim())}`
  }
  return null
}

function buildWhatsAppMapMessage(clubName, mapUrl, language) {
  const text = language === 'ar'
    ? `موقع ملعب ${clubName || 'النادي'} على الخريطة:\n${mapUrl}`
    : `Map location for ${clubName || 'the club'}:\n${mapUrl}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export default function BookingDetailModal({
  booking,
  club,
  platformUser,
  language,
  onClose,
  onUpdated,
  memberDirectory = [],
  showBrowseClubLink = true,
}) {
  const [markingPayAtClub, setMarkingPayAtClub] = useState(false)
  const [copied, setCopied] = useState(false)
  const [payMenuOpen, setPayMenuOpen] = useState(false)
  const [ackRefundBusy, setAckRefundBusy] = useState(false)
  const [tournamentExitBusy, setTournamentExitBusy] = useState(false)
  const [memberActionsOpen, setMemberActionsOpen] = useState(false)
  const [memberActionsSection, setMemberActionsSection] = useState('reschedule')
  const [bookerShareEditKey, setBookerShareEditKey] = useState(null)
  const [bookerSharePhoneDraft, setBookerSharePhoneDraft] = useState('')
  const [bookerShareBusy, setBookerShareBusy] = useState(false)
  const [participantRefundMenuRowKey, setParticipantRefundMenuRowKey] = useState(null)

  const dateStr = booking?.dateStr || booking?.date || (booking?.startDate || '').toString().split('T')[0]
  const startTime = booking?.startTime || booking?.timeSlot || ''
  const endTime = booking?.endTime || ''
  const courtName = booking?.resource || booking?.courtName || booking?.court || booking?.courtId || '—'
  const memberName = booking?.memberName || booking?.customerName || booking?.customer || '—'
  const status = (booking?.status || 'confirmed').toString()
  const isInitiator = platformUser && String(booking?.memberId || booking?.initiatorMemberId) === String(platformUser.id)
  const paymentShares = Array.isArray(booking?.paymentShares) ? booking.paymentShares : []
  const norm = (v) => (v || '').toString().trim().toLowerCase()
  const userShare = platformUser && booking ? findPaymentShareForMember(booking, platformUser) : null
  const [fetchedInviteToken, setFetchedInviteToken] = useState(null)
  const inviteToken = userShare?.inviteToken || fetchedInviteToken
  const needsRefundAck =
    !!platformUser && !!userShare && shareNeedsRefundAcknowledgment(userShare, platformUser)
  const userSharePaid = !!(userShare?.paidAt || userShare?.paid_at)
  const isParticipantWithShare = !!userShare && !userSharePaid && !needsRefundAck
  const chosePayAtClub = userShare && userShare.paymentMethod === 'at_club' && !userSharePaid
  const hasShares = paymentShares.length > 0
  const initiatorChosePayAtClub =
    !hasShares &&
    (norm(booking?.initiatorPaymentMethod || booking?.data?.initiatorPaymentMethod) === 'at_club' ||
      norm(booking?.paymentMethod || booking?.data?.paymentMethod) === 'at_club')

  useEffect(() => {
    if (!isParticipantWithShare || userShare?.inviteToken || !club?.id || !booking?.id || !platformUser?.id) return
    bookingApi.getShareInviteToken(booking.id, club.id, platformUser.id)
      .then(d => setFetchedInviteToken(d?.inviteToken || null))
      .catch(() => {})
  }, [isParticipantWithShare, userShare?.inviteToken, club?.id, booking?.id, platformUser?.id])
  const paidCount = paymentShares.filter(s => s.paidAt).length
  const pendingCount = paymentShares.length - paidCount
  const needsPayment = ['pending_payments', 'partially_paid'].includes(status)
  const isTournamentBooking = booking?.isTournament === true
  const tournamentEntry =
    isTournamentBooking && platformUser?.id && club
      ? getTournamentMemberPaymentEntry(club, booking, platformUser.id)
      : null
  const tournamentPaid = !!(tournamentEntry && (tournamentEntry.clubReceived || tournamentEntry.memberAck))
  const tournamentPayPending =
    !!tournamentEntry && !tournamentPaid && !['cancelled', 'expired'].includes(status)
  const tournamentChosePayAtClub =
    !!(tournamentEntry && tournamentEntry.paymentMethod === 'at_club' && !tournamentEntry.clubReceived && !tournamentEntry.memberAck)
  const tournamentFee = parseFloat(String(tournamentEntry?.fee || '').replace(',', '.')) || 0
  const mapUrl = getMapUrl(club)
  const clubName = language === 'ar' && club?.nameAr ? club.nameAr : club?.name
  const currency = club?.settings?.currency || 'SAR'
  const totalAmount = booking?.totalAmount ?? booking?.total_amount ?? 0
  const statusLc = (status || '').toLowerCase()
  const isBookingTerminal = ['cancelled', 'expired', 'cancelled_awaiting_refund_ack'].includes(statusLc)
  const canOpenMemberActions =
    !!club?.id && !isTournamentBooking && isInitiator && !!platformUser?.id && !isBookingTerminal

  const openMemberActions = (section) => {
    setMemberActionsSection(section === 'cancel' ? 'cancel' : 'reschedule')
    setMemberActionsOpen(true)
  }

  const handleMarkPayAtClub = useCallback(async () => {
    if (!club?.id || !booking?.id) return
    setMarkingPayAtClub(true)
    try {
      await bookingApi.markPayAtClub(booking.id, club.id)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      onUpdated?.()
      onClose?.()
    } catch (e) {
      console.error('markPayAtClub failed:', e)
    } finally {
      setMarkingPayAtClub(false)
    }
  }, [club?.id, booking?.id, onClose, onUpdated])

  const handleRecordPayment = useCallback(async () => {
    if (!club?.id || !platformUser?.id) return
    setMarkingPayAtClub(true)
    try {
      let token = inviteToken
      if (!token) {
        const d = await bookingApi.getShareInviteToken(booking.id, club.id, platformUser.id)
        token = d?.inviteToken
      }
      if (!token) {
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(language === 'ar' ? 'لم يتم العثور على رابط الدفع. جرّب خيار الدفع الإلكتروني.' : 'Payment link not found. Try the electronic payment option.')
        }
        return
      }
      await bookingApi.recordPayment({ inviteToken: token, clubId: club.id, paymentMethod: 'at_club' })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await onUpdated?.()
    } catch (e) {
      console.error('recordPayment failed:', e)
    } finally {
      setMarkingPayAtClub(false)
    }
  }, [inviteToken, club?.id, booking?.id, platformUser?.id, onClose, onUpdated, language])

  const handleAcknowledgeRefund = useCallback(async () => {
    if (!club?.id || !platformUser?.id || !userShare) return
    setAckRefundBusy(true)
    try {
      await bookingApi.acknowledgeShareRefund({
        shareId: userShare.id || undefined,
        inviteToken: userShare.inviteToken || undefined,
        clubId: club.id,
        memberId: platformUser.id,
        phone: platformUser.mobile || platformUser.phone
      })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await onUpdated?.()
    } catch (e) {
      console.error(e)
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(language === 'ar' ? (e?.message || 'فشل التأكيد') : (e?.message || 'Confirmation failed'))
      }
    } finally {
      setAckRefundBusy(false)
    }
  }, [club?.id, platformUser, userShare, onUpdated, language])

  const handleCopyLink = useCallback(() => {
    const url = window.location.href
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [])

  const handleShareMap = useCallback(() => {
    if (!mapUrl) return
    const waUrl = buildWhatsAppMapMessage(clubName, mapUrl, language)
    window.open(waUrl, '_blank')
  }, [mapUrl, clubName, language])

  const handleTournamentPayAtClub = useCallback(async () => {
    if (!club?.id || !booking?.id || !platformUser?.id) return
    setMarkingPayAtClub(true)
    try {
      await updateTournamentMemberPaymentEntry(club.id, booking.id, platformUser.id, { paymentMethod: 'at_club' })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await onUpdated?.()
    } catch (e) {
      console.error(e)
    } finally {
      setMarkingPayAtClub(false)
    }
  }, [club?.id, booking?.id, platformUser?.id, onUpdated])

  const handleTournamentLeave = useCallback(async () => {
    if (!club?.id || !booking?.id || !platformUser?.id) return
    const entryNow = getTournamentMemberPaymentEntry(club, booking, platformUser.id)
    const hadPaid = !!(entryNow && (entryNow.clubReceived || entryNow.memberAck))
    const msg = hadPaid
      ? (language === 'ar'
        ? 'مغادرة البطولة؟ تم تسجيل دفعك. تواصل مع النادي لترتيب الاسترداد إن كان من حقك.'
        : 'Leave this tournament? Your payment was recorded. Contact the club to arrange a refund if applicable.')
      : (language === 'ar'
        ? 'مغادرة البطولة؟ لم يكتمل دفعك — سيتم إزالتك من الفريق.'
        : 'Leave this tournament? You have not completed payment — you will be removed from the team.')
    if (typeof window !== 'undefined' && !window.confirm(msg)) return
    setTournamentExitBusy(true)
    try {
      const r = await withdrawMemberFromTournament(club.id, booking.id, platformUser.id)
      if (r?.ok && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      if (r?.ok) await onUpdated?.()
      onClose?.()
    } catch (e) {
      console.error(e)
    } finally {
      setTournamentExitBusy(false)
    }
  }, [club, booking, platformUser?.id, language, onUpdated, onClose])

  const t = {
    en: {
      title: 'Booking details',
      subtitle: 'Court booking',
      statusPendingPayment: 'Awaiting payment',
      statusConfirmed: 'Confirmed',
      statusPartiallyPaid: 'Partially paid',
      statusPendingPayments: 'Pending payments',
      statusOther: 'Status',
      edit: 'Reschedule or change',
      cancelBooking: 'Cancel booking',
      cancelBookingHint: 'Release the slot; request a refund if you already paid.',
      complete: 'Complete payment',
      share: 'Share booking',
      shareWithMember: 'Send to member',
      shareWithUnregistered: 'Send to unregistered',
      sendMap: 'Send map link',
      trackPayment: 'Payment progress',
      payNow: 'Pay now',
      payAtClub: 'Pay at club',
      payAtClubChosen: 'Chosen — pay at club',
      payElectronic: 'Pay electronically',
      switchToElectronic: 'Switch to electronic payment',
      goToClub: 'Open club page',
      secondaryActions: 'Sharing & location',
      paid: 'Paid',
      pending: 'Pending',
      waitingConfirm: 'Waiting for club confirmation',
      payAtClubPendingHint:
        'You chose to pay at the club. The desk will confirm when they receive your payment; you do not need to tap pay again.',
      participants: 'Participants',
      addShare: 'Add participant',
      close: 'Close',
      noMap: 'No address set',
      copied: 'Copied!',
      refundAckTitle: 'Refund pending your confirmation',
      refundAckHint: 'The club recorded a refund for your share. Confirm when you have received the money.',
      confirmRefundReceived: 'I received the refund',
      tournamentYourShare: 'Your share',
      tournamentLeave: 'Leave tournament',
      tournamentPayTitle: 'Complete your tournament payment',
      tournamentPayHint: 'Choose pay at the club (staff will confirm) or pay electronically.',
      editGuestPhone: 'Edit number',
      savePhone: 'Save',
      removeShare: 'Remove',
      confirmRemoveShare: 'Remove this participant? They have not paid yet.',
      shareManageError: 'Something went wrong. Try again.',
      cancelEdit: 'Cancel',
      participantLeaveShare: 'Leave split',
      participantLeaveConfirm: 'Remove yourself from this split? You have not paid yet.',
      participantRefundTitle: 'Request refund',
      participantRefundWallet: 'Credit club wallet',
      participantRefundCash: 'Cash at club',
      participantRefundCard: 'Back to card (online)',
      participantRefundAwaiting: 'Refund requested — club will process it',
    },
    ar: {
      title: 'تفاصيل الحجز',
      subtitle: 'حجز ملعب',
      statusPendingPayment: 'بانتظار الدفع',
      statusConfirmed: 'مؤكد',
      statusPartiallyPaid: 'مدفوع جزئياً',
      statusPendingPayments: 'دفعات معلّقة',
      statusOther: 'الحالة',
      edit: 'تغيير الموعد أو التفاصيل',
      cancelBooking: 'إلغاء الحجز',
      cancelBookingHint: 'إلغاء الموعد؛ وإن وُجد دفع مكتمل تُفتح مطالبة استعادة المبلغ.',
      complete: 'استكمال الدفع',
      share: 'مشاركة الحجز',
      shareWithMember: 'إرسال لعضو',
      shareWithUnregistered: 'إرسال لغير مسجل',
      sendMap: 'إرسال رابط الخريطة',
      trackPayment: 'متابعة الدفع',
      payNow: 'الدفع الآن',
      payAtClub: 'الدفع في النادي',
      payAtClubChosen: 'اخترتها — سأدفع في النادي',
      payElectronic: 'الدفع الإلكتروني',
      switchToElectronic: 'التبديل إلى الدفع الإلكتروني',
      goToClub: 'صفحة النادي',
      secondaryActions: 'مشاركة والموقع',
      paid: 'مدفوع',
      pending: 'قيد الانتظار',
      waitingConfirm: 'بانتظار التأكيد من النادي',
      payAtClubPendingHint:
        'اخترتَ الدفع في النادي. سيؤكد الاستقبال عند استلام المبلغ؛ لا حاجة للضغط على الدفع مرة أخرى.',
      participants: 'المشاركون',
      addShare: 'إضافة مشارك',
      close: 'إغلاق',
      noMap: 'لم يُضف عنوان',
      copied: 'تم النسخ!',
      refundAckTitle: 'الاسترداد بانتظار تأكيدك',
      refundAckHint: 'سجّل النادي استرداد حصتك. أكّد هنا عند استلام المبلغ.',
      confirmRefundReceived: 'استلمت الاسترداد',
      tournamentYourShare: 'حصتك',
      tournamentLeave: 'مغادرة البطولة',
      tournamentPayTitle: 'إتمام دفع البطولة',
      tournamentPayHint: 'اختر الدفع في النادي (يؤكد الاستقبال) أو الدفع الإلكتروني.',
      editGuestPhone: 'تعديل الرقم',
      savePhone: 'حفظ',
      removeShare: 'حذف المشاركة',
      confirmRemoveShare: 'إزالة هذا المشارك؟ لم يكمل الدفع بعد.',
      shareManageError: 'تعذر التنفيذ. حاول مرة أخرى.',
      cancelEdit: 'إلغاء',
      participantLeaveShare: 'إلغاء المشاركة',
      participantLeaveConfirm: 'إزالة نفسك من التقسيم؟ لم تدفع بعد.',
      participantRefundTitle: 'طلب استرداد المبلغ',
      participantRefundWallet: 'إلى محفظة النادي',
      participantRefundCash: 'كاش في النادي',
      participantRefundCard: 'إرجاع للبطاقة (دفع إلكتروني)',
      participantRefundAwaiting: 'تم طلب الاسترداد — بانتظار تنفيذ النادي',
    }
  }
  const c = t[language] || t.en

  const handleBookerUpdateSharePhone = async (s) => {
    if (!club?.id || !booking?.id || !platformUser?.id) return
    setBookerShareBusy(true)
    try {
      await bookingApi.bookerUpdateSharePhone({
        bookingId: booking.id,
        clubId: club.id,
        memberId: platformUser.id,
        shareId: s.id || undefined,
        inviteToken: s.inviteToken || undefined,
        phone: bookerSharePhoneDraft
      })
      setBookerShareEditKey(null)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await onUpdated?.()
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) window.alert(c.shareManageError)
    } finally {
      setBookerShareBusy(false)
    }
  }

  const handleBookerRemoveShare = async (s) => {
    if (!club?.id || !booking?.id || !platformUser?.id) return
    if (typeof window !== 'undefined' && !window.confirm(c.confirmRemoveShare)) return
    setBookerShareBusy(true)
    try {
      await bookingApi.bookerRemovePendingShare({
        bookingId: booking.id,
        clubId: club.id,
        memberId: platformUser.id,
        shareId: s.id || undefined,
        inviteToken: s.inviteToken || undefined
      })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await onUpdated?.()
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) window.alert(c.shareManageError)
    } finally {
      setBookerShareBusy(false)
    }
  }

  const handleParticipantLeaveShare = async (s) => {
    if (!club?.id || !booking?.id || !platformUser?.id) return
    if (typeof window !== 'undefined' && !window.confirm(c.participantLeaveConfirm)) return
    setBookerShareBusy(true)
    try {
      await bookingApi.memberRemoveOwnShare({
        bookingId: booking.id,
        clubId: club.id,
        memberId: platformUser.id,
        shareId: s.id || undefined,
        inviteToken: s.inviteToken || undefined,
        phone: platformUser.mobile || platformUser.phone
      })
      setParticipantRefundMenuRowKey(null)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await onUpdated?.()
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) window.alert(e?.message || c.shareManageError)
    } finally {
      setBookerShareBusy(false)
    }
  }

  const handleParticipantRequestRefund = async (s, refundRoute) => {
    if (!club?.id || !booking?.id || !platformUser?.id) return
    setBookerShareBusy(true)
    try {
      await bookingApi.memberRequestShareRefund({
        bookingId: booking.id,
        clubId: club.id,
        memberId: platformUser.id,
        shareId: s.id || undefined,
        inviteToken: s.inviteToken || undefined,
        refundRoute,
        phone: platformUser.mobile || platformUser.phone
      })
      setParticipantRefundMenuRowKey(null)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      await onUpdated?.()
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) window.alert(e?.message || c.shareManageError)
    } finally {
      setBookerShareBusy(false)
    }
  }

  let statusPillLabel = (status || '—').replace(/_/g, ' ')
  if (statusLc === 'pending_payment') statusPillLabel = c.statusPendingPayment
  else if (statusLc === 'confirmed') statusPillLabel = c.statusConfirmed
  else if (statusLc === 'partially_paid') statusPillLabel = c.statusPartiallyPaid
  else if (statusLc === 'pending_payments') statusPillLabel = c.statusPendingPayments

  return (
    <div className="booking-detail-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="booking-detail-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-detail-title"
        aria-describedby="booking-detail-desc"
      >
        <div className="booking-detail-modal-header">
          <div className="booking-detail-modal-header-text">
            <h3 id="booking-detail-title">{c.title}</h3>
            {clubName ? (
              <p id="booking-detail-desc" className="booking-detail-modal-subtitle">{clubName}</p>
            ) : (
              <p id="booking-detail-desc" className="booking-detail-modal-subtitle booking-detail-modal-subtitle--muted">{!isTournamentBooking ? c.subtitle : '\u00a0'}</p>
            )}
          </div>
          <button type="button" className="booking-detail-modal-close" onClick={onClose} aria-label={c.close}>×</button>
        </div>
        <div className="booking-detail-modal-body">
          <div className="booking-detail-summary-card">
            <div className="booking-detail-summary-top">
              <span className="booking-detail-status-pill" data-status={statusLc || 'unknown'}>{statusPillLabel}</span>
              {!isTournamentBooking && totalAmount > 0 ? (
                <span className="booking-detail-price-tag">{totalAmount} {currency}</span>
              ) : null}
            </div>
            <p className="booking-detail-court-name">{courtName}</p>
            <p className="booking-detail-datetime">
              <span className="booking-detail-datetime-date">{dateStr}</span>
              <span className="booking-detail-datetime-sep" aria-hidden>·</span>
              <span className="booking-detail-datetime-time">{startTime}{endTime ? ` – ${endTime}` : ''}</span>
            </p>
            <p className="booking-detail-customer booking-detail-customer--name">{memberName}</p>
            {isTournamentBooking && tournamentEntry && tournamentFee > 0 && (
              <p className="booking-detail-customer">{c.tournamentYourShare}: <strong>{tournamentFee} {currency}</strong></p>
            )}
            {status === 'pending_payment' && initiatorChosePayAtClub && (
              <p className="booking-detail-atclub-pending-hint">{c.payAtClubPendingHint}</p>
            )}
          </div>

          {needsRefundAck && club?.id && (
            <div className="booking-detail-refund-ack-banner">
              <p className="booking-detail-refund-ack-title">{c.refundAckTitle}</p>
              <p className="booking-detail-refund-ack-hint">{c.refundAckHint}</p>
              <button
                type="button"
                className="booking-detail-refund-ack-btn"
                disabled={ackRefundBusy}
                onClick={handleAcknowledgeRefund}
              >
                {ackRefundBusy ? '…' : c.confirmRefundReceived}
              </button>
            </div>
          )}

          <div className="booking-detail-actions">
            {tournamentPayPending && club?.id && platformUser?.id && (
              <div className="booking-detail-tournament-pay">
                <p className="booking-detail-tournament-pay-title">{c.tournamentPayTitle}</p>
                <p className="booking-detail-tournament-pay-hint">{c.tournamentPayHint}</p>
                <div className="booking-detail-pay-now-wrap">
                  <button
                    type="button"
                    className={`booking-detail-pay-now-btn ${payMenuOpen ? 'booking-detail-pay-now-btn-open' : ''}`}
                    onClick={() => setPayMenuOpen(!payMenuOpen)}
                    disabled={markingPayAtClub}
                  >
                    <span className="booking-detail-pay-now-icon">💳</span>
                    <span>{markingPayAtClub ? '…' : c.payNow}</span>
                    <span className="booking-detail-pay-now-chevron" aria-hidden>▼</span>
                  </button>
                  {payMenuOpen && (
                    <div className="booking-detail-pay-options">
                      <button
                        type="button"
                        className={`booking-detail-pay-opt ${tournamentChosePayAtClub ? 'booking-detail-pay-opt-chosen' : ''}`}
                        onClick={handleTournamentPayAtClub}
                        disabled={markingPayAtClub || tournamentChosePayAtClub}
                        aria-pressed={tournamentChosePayAtClub}
                      >
                        <span className="booking-detail-pay-opt-icon">🏢</span>
                        {tournamentChosePayAtClub ? <span className="booking-detail-pay-opt-check" aria-hidden>✓ </span> : null}
                        {tournamentChosePayAtClub ? c.payAtClubChosen : c.payAtClub}
                      </button>
                      <Link
                        to={`/pay/tournament-member/${club.id}/${booking.id}?memberId=${encodeURIComponent(String(platformUser.id))}`}
                        className="booking-detail-pay-opt booking-detail-pay-opt-link"
                        onClick={onClose}
                      >
                        <span className="booking-detail-pay-opt-icon">💳</span>
                        {tournamentChosePayAtClub ? c.switchToElectronic : c.payElectronic}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(isInitiator || isParticipantWithShare) && needsPayment && !userShare?.paidAt && !isTournamentBooking && (
              <div className="booking-detail-pay-now-wrap">
                <button
                  type="button"
                  className={`booking-detail-pay-now-btn ${payMenuOpen ? 'booking-detail-pay-now-btn-open' : ''}`}
                  onClick={() => setPayMenuOpen(!payMenuOpen)}
                  disabled={markingPayAtClub}
                >
                  <span className="booking-detail-pay-now-icon">💳</span>
                  <span>{markingPayAtClub ? '…' : c.payNow}</span>
                  <span className="booking-detail-pay-now-chevron" aria-hidden>▼</span>
                </button>
                {payMenuOpen && (
                  <div className="booking-detail-pay-options">
                    {(inviteToken || isParticipantWithShare) ? (
                      <>
                        <button
                          type="button"
                          className={`booking-detail-pay-opt ${chosePayAtClub ? 'booking-detail-pay-opt-chosen' : ''}`}
                          onClick={handleRecordPayment}
                          disabled={markingPayAtClub || chosePayAtClub}
                          aria-pressed={chosePayAtClub}
                        >
                          <span className="booking-detail-pay-opt-icon">🏢</span>
                          {chosePayAtClub ? <span className="booking-detail-pay-opt-check" aria-hidden>✓ </span> : null}
                          {chosePayAtClub ? c.payAtClubChosen : c.payAtClub}
                        </button>
                        <Link
                          to={inviteToken ? `/pay-share/${inviteToken}` : `/pay-share/booking/${booking.id}?clubId=${club.id}`}
                          className="booking-detail-pay-opt booking-detail-pay-opt-link"
                          onClick={onClose}
                        >
                          <span className="booking-detail-pay-opt-icon">💳</span>
                          {chosePayAtClub ? c.switchToElectronic : c.payElectronic}
                        </Link>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`booking-detail-pay-opt ${initiatorChosePayAtClub ? 'booking-detail-pay-opt-chosen' : ''}`}
                          onClick={handleMarkPayAtClub}
                          disabled={markingPayAtClub || initiatorChosePayAtClub}
                          aria-pressed={initiatorChosePayAtClub}
                        >
                          <span className="booking-detail-pay-opt-icon">🏢</span>
                          {initiatorChosePayAtClub ? <span className="booking-detail-pay-opt-check" aria-hidden>✓ </span> : null}
                          {initiatorChosePayAtClub ? c.payAtClubChosen : c.payAtClub}
                        </button>
                        <Link to={`/pay/${booking.id}?method=credit_card`} className="booking-detail-pay-opt booking-detail-pay-opt-link" onClick={onClose}>
                          <span className="booking-detail-pay-opt-icon">💳</span>
                          {c.payElectronic}
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {canOpenMemberActions && (
              <div className="booking-detail-primary-row">
                <button
                  type="button"
                  className="booking-detail-primary-btn booking-detail-primary-btn--edit"
                  onClick={() => openMemberActions('reschedule')}
                >
                  <span className="booking-detail-primary-icon" aria-hidden>✏️</span>
                  <span className="booking-detail-primary-text">
                    <span className="booking-detail-primary-label">{c.edit}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="booking-detail-primary-btn booking-detail-primary-btn--cancel"
                  onClick={() => openMemberActions('cancel')}
                >
                  <span className="booking-detail-primary-icon" aria-hidden>⛔</span>
                  <span className="booking-detail-primary-text">
                    <span className="booking-detail-primary-label">{c.cancelBooking}</span>
                  </span>
                </button>
              </div>
            )}
            {canOpenMemberActions ? (
              <p className="booking-detail-primary-hint">{c.cancelBookingHint}</p>
            ) : null}

            {club?.id && !isTournamentBooking && !isInitiator && (
              <Link to={`/clubs/${club.id}#court-booking`} className="booking-detail-action booking-detail-action-accent" onClick={onClose}>
                <span className="booking-detail-action-icon">📅</span>
                <span>{language === 'ar' ? 'صفحة الحجز في النادي' : 'Open booking at club'}</span>
              </Link>
            )}

            {isTournamentBooking && tournamentEntry && platformUser?.id && !['cancelled', 'expired'].includes(statusLc) && (
              <button
                type="button"
                className="booking-detail-action booking-detail-action-danger"
                disabled={tournamentExitBusy}
                onClick={handleTournamentLeave}
              >
                <span className="booking-detail-action-icon">🚪</span>
                <span>{tournamentExitBusy ? '…' : c.tournamentLeave}</span>
              </button>
            )}

            <p className="booking-detail-section-label">{c.secondaryActions}</p>
            <div className="booking-detail-secondary-grid">
              <button type="button" className="booking-detail-tile" onClick={handleCopyLink}>
                <span className="booking-detail-tile-icon" aria-hidden>📤</span>
                <span className="booking-detail-tile-label">{copied ? c.copied : c.share}</span>
              </button>
              {mapUrl ? (
                <button type="button" className="booking-detail-tile" onClick={handleShareMap}>
                  <span className="booking-detail-tile-icon" aria-hidden>📍</span>
                  <span className="booking-detail-tile-label">{c.sendMap}</span>
                </button>
              ) : (
                <span className="booking-detail-tile booking-detail-tile--disabled" title={c.noMap}>
                  <span className="booking-detail-tile-icon" aria-hidden>📍</span>
                  <span className="booking-detail-tile-label">{c.sendMap}</span>
                </span>
              )}
            </div>

            {hasShares && (
              <div className="booking-detail-track">
                <p className="booking-detail-track-title">{c.trackPayment}</p>
                <p>{paidCount} {c.paid} · {pendingCount} {c.pending}</p>
                <div className="booking-detail-shares">
                  {paymentShares.filter((s) => !(s.removedAt || s.removed_at)).slice(0, 5).map((s, idx) => {
                    const pd = s.paidAt || s.paid_at
                    const rf = s.refundedAt || s.refunded_at
                    const isMyShare = userShare && isSamePaymentShare(s, userShare)
                    const shareAmt = parseFloat(s.amount)
                    const rowKey = String(s.id || s.inviteToken || idx)
                    const canBookerManageShare =
                      canOpenMemberActions &&
                      !!(s.inviteToken) &&
                      !pd &&
                      !rf
                    const payAbs =
                      (s.payInviteUrl || s.pay_invite_url || '') ||
                      (s.inviteToken ? buildPayShareAbsoluteUrl(s.inviteToken, s.type) : '')
                    const waTarget = payAbs ? buildWhatsAppHrefForSplitInvite(s.phone, payAbs, language) : (s.whatsappLink || '')
                    const isEditingShare = bookerShareEditKey === rowKey
                    const memberReqAt = s.memberRefundRequestedAt || s.member_refund_requested_at
                    const refundMenuOpen = participantRefundMenuRowKey === rowKey
                    const allowElRefund = sharePaymentAllowsElectronicRefund(s)
                    return (
                      <div key={rowKey} className="booking-detail-share-row">
                        {isEditingShare ? (
                          <div className="booking-detail-share-edit">
                            <input
                              type="tel"
                              className="booking-detail-share-edit-input"
                              value={bookerSharePhoneDraft}
                              onChange={(e) => setBookerSharePhoneDraft(e.target.value)}
                              inputMode="tel"
                              autoComplete="tel"
                              aria-label={c.editGuestPhone}
                            />
                            <div className="booking-detail-share-edit-btns">
                              <button
                                type="button"
                                className="booking-detail-share-edit-save"
                                disabled={bookerShareBusy}
                                onClick={() => handleBookerUpdateSharePhone(s)}
                              >
                                {bookerShareBusy ? '…' : c.savePhone}
                              </button>
                              <button
                                type="button"
                                className="booking-detail-share-edit-cancel"
                                disabled={bookerShareBusy}
                                onClick={() => setBookerShareEditKey(null)}
                              >
                                {c.cancelEdit}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                        <span className="booking-detail-share-name">
                          {resolvePaymentShareDisplayName(s, memberDirectory)}
                          {isInitiator && Number.isFinite(shareAmt) ? (
                            <span className="booking-detail-share-amount"> — {shareAmt} {currency}</span>
                          ) : null}
                        </span>
                        <span className={`booking-detail-share-status ${pd ? 'paid' : ''}`}>
                          {rf && !s.refundAcknowledgedAt
                            ? '⏳ ' + (language === 'ar' ? 'بانتظار تأكيد الاسترداد' : 'Awaiting refund confirmation')
                            : rf && s.refundAcknowledgedAt
                              ? '✓ ' + (language === 'ar' ? 'أُكّد الاسترداد' : 'Refund confirmed')
                              : pd
                                ? '✓ ' + c.paid
                                : s.paymentMethod === 'at_club'
                                  ? '◐ ' + c.waitingConfirm
                                  : '○ ' + c.pending}
                        </span>
                        <span className="booking-detail-share-actions">
                        {isMyShare && !pd && needsPayment && (
                          <button
                            type="button"
                            className="booking-detail-share-pay-btn"
                            onClick={() => setPayMenuOpen(prev => !prev)}
                          >
                            {c.payNow}
                          </button>
                        )}
                        {!isMyShare && waTarget && !pd && (
                          <a href={waTarget} target="_blank" rel="noopener noreferrer" className="booking-detail-resend" title="WhatsApp">💬</a>
                        )}
                        {canBookerManageShare ? (
                          <>
                            <button
                              type="button"
                              className="booking-detail-share-icon-btn"
                              title={c.editGuestPhone}
                              aria-label={c.editGuestPhone}
                              disabled={bookerShareBusy}
                              onClick={() => {
                                setBookerShareEditKey(rowKey)
                                setBookerSharePhoneDraft(normalizePhone(s.phone || ''))
                              }}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="booking-detail-share-icon-btn booking-detail-share-icon-btn--danger"
                              title={c.removeShare}
                              aria-label={c.removeShare}
                              disabled={bookerShareBusy}
                              onClick={() => handleBookerRemoveShare(s)}
                            >
                              🗑
                            </button>
                          </>
                        ) : null}
                        {(() => {
                          const removed = !!(s.removedAt || s.removed_at)
                          const showLeave =
                            isMyShare &&
                            !!s.inviteToken &&
                            !pd &&
                            !rf &&
                            !memberReqAt &&
                            !removed &&
                            !isBookingTerminal
                          const showRefund =
                            isMyShare &&
                            !!s.inviteToken &&
                            !!pd &&
                            !rf &&
                            !memberReqAt &&
                            !removed &&
                            !isBookingTerminal
                          const showRefundPending =
                            isMyShare && !!memberReqAt && !rf && !removed
                          if (!showLeave && !showRefund && !showRefundPending) return null
                          return (
                            <span className="booking-detail-participant-self-wrap">
                              {showRefundPending ? (
                                <span className="booking-detail-share-refund-pending">{c.participantRefundAwaiting}</span>
                              ) : null}
                              {showLeave ? (
                                <button
                                  type="button"
                                  className="booking-detail-participant-leave"
                                  disabled={bookerShareBusy}
                                  onClick={() => handleParticipantLeaveShare(s)}
                                >
                                  {c.participantLeaveShare}
                                </button>
                              ) : null}
                              {showRefund ? (
                                <span className="booking-detail-participant-refund">
                                  <button
                                    type="button"
                                    className="booking-detail-participant-refund-toggle"
                                    disabled={bookerShareBusy}
                                    onClick={() => setParticipantRefundMenuRowKey(refundMenuOpen ? null : rowKey)}
                                  >
                                    {c.participantRefundTitle} ▾
                                  </button>
                                  {refundMenuOpen ? (
                                    <span className="booking-detail-participant-refund-menu">
                                      <button
                                        type="button"
                                        className="booking-detail-participant-refund-item"
                                        disabled={bookerShareBusy}
                                        onClick={() => handleParticipantRequestRefund(s, 'wallet')}
                                      >
                                        {c.participantRefundWallet}
                                      </button>
                                      <button
                                        type="button"
                                        className="booking-detail-participant-refund-item"
                                        disabled={bookerShareBusy}
                                        onClick={() => handleParticipantRequestRefund(s, 'cash')}
                                      >
                                        {c.participantRefundCash}
                                      </button>
                                      {allowElRefund ? (
                                        <button
                                          type="button"
                                          className="booking-detail-participant-refund-item"
                                          disabled={bookerShareBusy}
                                          onClick={() => handleParticipantRequestRefund(s, 'electronic')}
                                        >
                                          {c.participantRefundCard}
                                        </button>
                                      ) : null}
                                    </span>
                                  ) : null}
                                </span>
                              ) : null}
                            </span>
                          )
                        })()}
                        </span>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {showBrowseClubLink && club?.id && (
              <Link to={`/clubs/${club.id}`} className="booking-detail-action booking-detail-action-link booking-detail-action-tertiary" onClick={onClose}>
                <span className="booking-detail-action-icon">🏟</span>
                <span>{c.goToClub}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
      {memberActionsOpen && club && booking && platformUser && (
        <MemberBookingActionsModal
          key={`${booking.id}-${memberActionsSection}`}
          booking={booking}
          club={club}
          platformUser={platformUser}
          language={language}
          initialSection={memberActionsSection}
          onClose={() => setMemberActionsOpen(false)}
          onUpdated={() => {
            onUpdated?.()
            setMemberActionsOpen(false)
            onClose?.()
          }}
        />
      )}
    </div>
  )
}
