/**
 * Modal لتعديل الحجز، استكمال الدفع، مشاركة الحجز، إرسال رابط الخريطة، ومتابعة الدفع
 */
import React, { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import * as bookingApi from '../api/dbClient'
import { resolvePaymentShareDisplayName, shareNeedsRefundAcknowledgment } from '../utils/paymentShareMemberMatch'
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

export default function BookingDetailModal({ booking, club, platformUser, language, onClose, onUpdated, memberDirectory = [] }) {
  const [markingPayAtClub, setMarkingPayAtClub] = useState(false)
  const [copied, setCopied] = useState(false)
  const [payMenuOpen, setPayMenuOpen] = useState(false)
  const [ackRefundBusy, setAckRefundBusy] = useState(false)
  const [tournamentExitBusy, setTournamentExitBusy] = useState(false)

  const dateStr = booking?.dateStr || booking?.date || (booking?.startDate || '').toString().split('T')[0]
  const startTime = booking?.startTime || booking?.timeSlot || ''
  const endTime = booking?.endTime || ''
  const courtName = booking?.resource || booking?.courtName || booking?.court || booking?.courtId || '—'
  const memberName = booking?.memberName || booking?.customerName || booking?.customer || '—'
  const status = (booking?.status || 'confirmed').toString()
  const isInitiator = platformUser && String(booking?.memberId || booking?.initiatorMemberId) === String(platformUser.id)
  const paymentShares = Array.isArray(booking?.paymentShares) ? booking.paymentShares : []
  const norm = (v) => (v || '').toString().trim().toLowerCase()
  const userShare = platformUser && paymentShares.find(s => {
    if (String(s.memberId || '') === String(platformUser.id)) return true
    const userName = norm(platformUser.name || platformUser.displayName || platformUser.email || '')
    const shareName = norm(s.memberName || '')
    if (userName && shareName && shareName.includes(userName)) return true
    if (userName && shareName && userName.includes(shareName)) return true
    const userPhone = (platformUser.mobile || platformUser.phone || '').toString().replace(/\D/g, '')
    const sharePhone = (s.phone || '').toString().replace(/\D/g, '')
    if (userPhone && sharePhone && userPhone.slice(-8) === sharePhone.slice(-8)) return true
    return false
  })
  const [fetchedInviteToken, setFetchedInviteToken] = useState(null)
  const inviteToken = userShare?.inviteToken || fetchedInviteToken
  const needsRefundAck =
    !!platformUser && !!userShare && shareNeedsRefundAcknowledgment(userShare, platformUser)
  const isParticipantWithShare = !!userShare && !userShare.paidAt && !needsRefundAck
  const chosePayAtClub = userShare && userShare.paymentMethod === 'at_club' && !userShare.paidAt
  const hasShares = paymentShares.length > 0
  const initiatorChosePayAtClub = !hasShares && (booking?.initiatorPaymentMethod === 'at_club' || booking?.data?.initiatorPaymentMethod === 'at_club')

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
      edit: 'Edit booking',
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
      goToClub: 'View club',
      paid: 'Paid',
      pending: 'Pending',
      waitingConfirm: 'Waiting for club confirmation',
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
    },
    ar: {
      title: 'تفاصيل الحجز',
      edit: 'تعديل الحجز',
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
      goToClub: 'عرض النادي',
      paid: 'مدفوع',
      pending: 'قيد الانتظار',
      waitingConfirm: 'بانتظار التأكيد من النادي',
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
    }
  }
  const c = t[language] || t.en

  return (
    <div className="booking-detail-modal-backdrop" onClick={onClose} role="presentation">
      <div className="booking-detail-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="booking-detail-title">
        <div className="booking-detail-modal-header">
          <h3 id="booking-detail-title">{c.title}</h3>
          <button type="button" className="booking-detail-modal-close" onClick={onClose} aria-label={c.close}>×</button>
        </div>
        <div className="booking-detail-modal-body">
          <div className="booking-detail-summary">
            <p><strong>{courtName}</strong></p>
            <p>{dateStr} · {startTime}{endTime ? ` – ${endTime}` : ''}</p>
            <p className="booking-detail-customer">{memberName}</p>
            {isTournamentBooking && tournamentEntry && tournamentFee > 0 && (
              <p className="booking-detail-customer">{c.tournamentYourShare}: {tournamentFee} {currency}</p>
            )}
            {!isTournamentBooking && totalAmount > 0 && <p>{totalAmount} {currency}</p>}
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
            {club?.id && !isTournamentBooking && (
              <Link to={`/clubs/${club.id}#court-booking`} className="booking-detail-action" onClick={onClose}>
                <span className="booking-detail-action-icon">✏️</span>
                <span>{c.edit}</span>
              </Link>
            )}

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

            {isTournamentBooking && tournamentEntry && platformUser?.id && !['cancelled', 'expired'].includes(status) && (
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

            <button type="button" className="booking-detail-action" onClick={handleCopyLink}>
              <span className="booking-detail-action-icon">📤</span>
              <span>{copied ? c.copied : c.share}</span>
            </button>

            {mapUrl ? (
              <button type="button" className="booking-detail-action" onClick={handleShareMap}>
                <span className="booking-detail-action-icon">📍</span>
                <span>{c.sendMap}</span>
              </button>
            ) : (
              <span className="booking-detail-action booking-detail-action-disabled" title={c.noMap}>
                <span className="booking-detail-action-icon">📍</span>
                <span>{c.sendMap}</span>
              </span>
            )}

            {hasShares && (
              <div className="booking-detail-track">
                <p className="booking-detail-track-title">{c.trackPayment}</p>
                <p>{paidCount} {c.paid} · {pendingCount} {c.pending}</p>
                <div className="booking-detail-shares">
                  {paymentShares.slice(0, 5).map((s, idx) => {
                    const isMyShare = userShare && (s.id === userShare.id || (s.memberId === userShare.memberId && s.memberName === userShare.memberName))
                    const shareAmt = parseFloat(s.amount)
                    return (
                      <div key={s.id || idx} className="booking-detail-share-row">
                        <span className="booking-detail-share-name">
                          {resolvePaymentShareDisplayName(s, memberDirectory)}
                          {isInitiator && Number.isFinite(shareAmt) ? (
                            <span className="booking-detail-share-amount"> — {shareAmt} {currency}</span>
                          ) : null}
                        </span>
                        <span className={`booking-detail-share-status ${s.paidAt ? 'paid' : ''}`}>
                          {s.refundedAt && !s.refundAcknowledgedAt
                            ? '⏳ ' + (language === 'ar' ? 'بانتظار تأكيد الاسترداد' : 'Awaiting refund confirmation')
                            : s.refundedAt && s.refundAcknowledgedAt
                              ? '✓ ' + (language === 'ar' ? 'أُكّد الاسترداد' : 'Refund confirmed')
                              : s.paidAt
                                ? '✓ ' + c.paid
                                : s.paymentMethod === 'at_club'
                                  ? '◐ ' + c.waitingConfirm
                                  : '○ ' + c.pending}
                        </span>
                        {isMyShare && !s.paidAt && needsPayment && (
                          <button
                            type="button"
                            className="booking-detail-share-pay-btn"
                            onClick={() => setPayMenuOpen(prev => !prev)}
                          >
                            {c.payNow}
                          </button>
                        )}
                        {!isMyShare && s.whatsappLink && !s.paidAt && (
                          <a href={s.whatsappLink} target="_blank" rel="noopener noreferrer" className="booking-detail-resend" title="Resend">💬</a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {club?.id && (
              <Link to={`/clubs/${club.id}`} className="booking-detail-action booking-detail-action-link" onClick={onClose}>
                <span className="booking-detail-action-icon">🏟</span>
                <span>{c.goToClub}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
