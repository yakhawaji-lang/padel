/**
 * Modal لتعديل الحجز، استكمال الدفع، مشاركة الحجز، إرسال رابط الخريطة، ومتابعة الدفع
 */
import React, { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import * as bookingApi from '../api/dbClient'
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

export default function BookingDetailModal({ booking, club, platformUser, language, onClose, onUpdated }) {
  const [markingPayAtClub, setMarkingPayAtClub] = useState(false)
  const [copied, setCopied] = useState(false)
  const [payMenuOpen, setPayMenuOpen] = useState(false)

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
  const isParticipantWithShare = !!userShare && !userShare.paidAt
  const chosePayAtClub = userShare && userShare.paymentMethod === 'at_club' && !userShare.paidAt

  useEffect(() => {
    if (!isParticipantWithShare || userShare?.inviteToken || !club?.id || !booking?.id || !platformUser?.id) return
    bookingApi.getShareInviteToken(booking.id, club.id, platformUser.id)
      .then(d => setFetchedInviteToken(d?.inviteToken || null))
      .catch(() => {})
  }, [isParticipantWithShare, userShare?.inviteToken, club?.id, booking?.id, platformUser?.id])
  const hasShares = paymentShares.length > 0
  const paidCount = paymentShares.filter(s => s.paidAt).length
  const pendingCount = paymentShares.length - paidCount
  const needsPayment = ['pending_payments', 'partially_paid'].includes(status)
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
      onUpdated?.()
      onClose?.()
    } catch (e) {
      console.error('recordPayment failed:', e)
    } finally {
      setMarkingPayAtClub(false)
    }
  }, [inviteToken, club?.id, booking?.id, platformUser?.id, onClose, onUpdated, language])

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
      participants: 'Participants',
      addShare: 'Add participant',
      close: 'Close',
      noMap: 'No address set',
      copied: 'Copied!'
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
      participants: 'المشاركون',
      addShare: 'إضافة مشارك',
      close: 'إغلاق',
      noMap: 'لم يُضف عنوان',
      copied: 'تم النسخ!'
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
            {totalAmount > 0 && <p>{totalAmount} {currency}</p>}
          </div>

          <div className="booking-detail-actions">
            {club?.id && (
              <Link to={`/clubs/${club.id}#court-booking`} className="booking-detail-action" onClick={onClose}>
                <span className="booking-detail-action-icon">✏️</span>
                <span>{c.edit}</span>
              </Link>
            )}

            {(isInitiator || isParticipantWithShare) && needsPayment && !userShare?.paidAt && (
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
                        >
                          <span className="booking-detail-pay-opt-icon">🏢</span>
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
                        <button type="button" className="booking-detail-pay-opt" onClick={handleMarkPayAtClub} disabled={markingPayAtClub}>
                          <span className="booking-detail-pay-opt-icon">🏢</span>
                          {c.payAtClub}
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
                    return (
                      <div key={s.id || idx} className="booking-detail-share-row">
                        <span>{s.memberName || s.phone || '—'}</span>
                        <span className={s.paidAt ? 'paid' : ''}>{s.paidAt ? '✓' : '○'}</span>
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
