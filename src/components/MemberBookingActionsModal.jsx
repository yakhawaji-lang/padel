/**
 * Member: reschedule court booking (fees + wallet) or request cancel/refund per club policy.
 */
import React, { useState, useEffect, useCallback } from 'react'
import * as bookingApi from '../api/dbClient'
import './MemberBookingActionsModal.css'

export default function MemberBookingActionsModal({ booking, club, platformUser, language, onClose, onUpdated }) {
  const [quote, setQuote] = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dateStr, setDateStr] = useState('')
  const [courtId, setCourtId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [payFeeFromWallet, setPayFeeFromWallet] = useState(true)

  const clubId = club?.id
  const bookingId = booking?.id
  const memberId = platformUser?.id
  const currency = club?.settings?.currency || 'SAR'

  const t = {
    en: {
      title: 'Change or cancel booking',
      loading: 'Loading…',
      wallet: 'Wallet balance',
      rescheduleTitle: 'Reschedule',
      feeHint: 'First edits may be free; then club fees apply.',
      nextFee: 'Change fee (this edit)',
      freeEdit: 'No fee for this change.',
      payFeeWallet: 'Pay fee from my wallet',
      date: 'Date',
      court: 'Court',
      start: 'Start',
      end: 'End',
      apply: 'Save new time',
      cancelTitle: 'Cancel & refund',
      cancelHint: 'Within the club cancellation window. Fees may apply.',
      refundWallet: 'Refund to my club wallet',
      refundOriginal: 'Request refund to original payment (club processes)',
      notAllowed: 'Not allowed at this time.',
      hoursLeft: 'Hours until start',
      success: 'Done.',
      close: 'Close',
    },
    ar: {
      title: 'تعديل أو إلغاء الحجز',
      loading: 'جاري التحميل…',
      wallet: 'رصيد المحفظة',
      rescheduleTitle: 'تغيير الموعد',
      feeHint: 'قد يكون أول تعديل مجانياً، ثم تُطبَّق رسوم النادي.',
      nextFee: 'رسوم التعديل (هذه المرة)',
      freeEdit: 'لا رسوم على هذا التعديل.',
      payFeeWallet: 'دفع الرسوم من محفظتي',
      date: 'التاريخ',
      court: 'الملعب',
      start: 'البداية',
      end: 'النهاية',
      apply: 'حفظ الموعد الجديد',
      cancelTitle: 'إلغاء واسترداد',
      cancelHint: 'ضمن المهلة المسموحة من النادي. قد تُطبَّق رسوم.',
      refundWallet: 'استرداد إلى محفظتي في النادي',
      refundOriginal: 'طلب استرداد للدفع الأصلي (يعالجه النادي)',
      notAllowed: 'غير مسموح حالياً.',
      hoursLeft: 'ساعات حتى بداية الحجز',
      success: 'تم.',
      close: 'إغلاق',
    },
  }
  const c = t[language] || t.en

  const loadQuote = useCallback(async () => {
    if (!clubId || !bookingId || !memberId) return
    setLoadErr(null)
    try {
      const q = await bookingApi.memberBookingSelfServiceQuote({ bookingId, clubId, memberId })
      setQuote(q)
    } catch (e) {
      setLoadErr(e?.message || 'Error')
      setQuote(null)
    }
  }, [clubId, bookingId, memberId])

  useEffect(() => {
    loadQuote()
  }, [loadQuote])

  useEffect(() => {
    const d = (booking?.dateStr || booking?.date || '').toString().split('T')[0]
    setDateStr(d || '')
    const court = (booking?.resource || booking?.courtName || booking?.courtId || '').toString()
    setCourtId(court)
    setStartTime((booking?.startTime || '').toString())
    setEndTime((booking?.endTime || '').toString())
  }, [booking])

  const courts = Array.isArray(club?.courts) ? club.courts.filter((x) => !x.maintenance) : []

  const handleReschedule = async () => {
    if (!clubId || !bookingId || !memberId || !dateStr || !courtId || !startTime || !endTime) return
    setBusy(true)
    setLoadErr(null)
    try {
      const fee = quote?.nextRescheduleFee || 0
      await bookingApi.memberRescheduleBooking({
        bookingId,
        clubId,
        memberId,
        date: dateStr,
        courtId,
        startTime,
        endTime,
        payFeeFromWallet: fee > 0 ? payFeeFromWallet : false,
      })
      await loadQuote()
      onUpdated?.()
      if (typeof window !== 'undefined' && window.alert) window.alert(c.success)
      onClose?.()
    } catch (e) {
      setLoadErr(e?.message || (language === 'ar' ? 'فشل الطلب' : 'Request failed'))
    } finally {
      setBusy(false)
    }
  }

  const handleRefund = async (refundRoute) => {
    if (!clubId || !bookingId || !memberId) return
    if (typeof window !== 'undefined' && !window.confirm(language === 'ar' ? 'تأكيد إلغاء الحجز؟' : 'Cancel this booking?')) return
    setBusy(true)
    setLoadErr(null)
    try {
      await bookingApi.memberRefundRequest({ bookingId, clubId, memberId, refundRoute })
      onUpdated?.()
      if (typeof window !== 'undefined' && window.alert) window.alert(c.success)
      onClose?.()
    } catch (e) {
      setLoadErr(e?.message || (language === 'ar' ? 'فشل الطلب' : 'Request failed'))
    } finally {
      setBusy(false)
    }
  }

  if (!booking || !club || !platformUser) return null

  return (
    <div className="member-booking-actions-backdrop" onClick={onClose} role="presentation">
      <div className="member-booking-actions-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="member-booking-actions-head">
          <h3>{c.title}</h3>
          <button type="button" className="member-booking-actions-close" onClick={onClose} aria-label={c.close}>×</button>
        </div>
        {loadErr && <div className="member-booking-actions-err">{loadErr}</div>}
        {!quote && !loadErr && <p className="member-booking-actions-muted">{c.loading}</p>}
        {quote && (
          <div className="member-booking-actions-body">
            <p className="member-booking-actions-wallet">
              {c.wallet}: <strong>{quote.walletBalance?.toFixed ? quote.walletBalance.toFixed(2) : quote.walletBalance} {currency}</strong>
            </p>
            <p className="member-booking-actions-muted">{c.feeHint}</p>

            <section className="member-booking-actions-section">
              <h4>{c.rescheduleTitle}</h4>
              {(quote.nextRescheduleFee || 0) > 0 ? (
                <p className="member-booking-actions-fee">{c.nextFee}: <strong>{quote.nextRescheduleFee} {currency}</strong></p>
              ) : (
                <p className="member-booking-actions-ok">{c.freeEdit}</p>
              )}
              {(quote.nextRescheduleFee || 0) > 0 && (
                <label className="member-booking-actions-check">
                  <input type="checkbox" checked={payFeeFromWallet} onChange={(e) => setPayFeeFromWallet(e.target.checked)} />
                  {c.payFeeWallet}
                </label>
              )}
              <div className="member-booking-actions-grid">
                <label>
                  {c.date}
                  <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="member-booking-actions-input" />
                </label>
                <label>
                  {c.court}
                  <select value={courtId} onChange={(e) => setCourtId(e.target.value)} className="member-booking-actions-input">
                    {courts.map((co) => {
                      const id = (co.id != null && co.id !== '') ? String(co.id) : String(co.name || '')
                      const label = language === 'ar' && co.nameAr ? co.nameAr : (co.name || id)
                      return (
                        <option key={id} value={id}>{label}</option>
                      )
                    })}
                  </select>
                </label>
                <label>
                  {c.start}
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="member-booking-actions-input" />
                </label>
                <label>
                  {c.end}
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="member-booking-actions-input" />
                </label>
              </div>
              <button type="button" className="member-booking-actions-primary" disabled={busy} onClick={handleReschedule}>
                {busy ? '…' : c.apply}
              </button>
            </section>

            <section className="member-booking-actions-section member-booking-actions-section--danger">
              <h4>{c.cancelTitle}</h4>
              <p className="member-booking-actions-muted">{c.cancelHint}</p>
              {quote.hoursUntilStart != null && (
                <p className="member-booking-actions-muted">{c.hoursLeft}: {quote.hoursUntilStart.toFixed(1)}</p>
              )}
              {quote.cancelAllowed ? (
                <>
                  <p className="member-booking-actions-fee">
                    {language === 'ar' ? 'صافي الاسترداد التقريبي' : 'Estimated net refund'}:{' '}
                    <strong>{quote.estimatedRefundNet} {currency}</strong>
                    {quote.cancelFee > 0 ? <span> ({language === 'ar' ? 'بعد خصم' : 'after fee'} {quote.cancelFee})</span> : null}
                  </p>
                  <div className="member-booking-actions-refund-btns">
                    <button type="button" className="member-booking-actions-secondary" disabled={busy} onClick={() => handleRefund('wallet')}>
                      {c.refundWallet}
                    </button>
                    <button type="button" className="member-booking-actions-secondary" disabled={busy} onClick={() => handleRefund('original')}>
                      {c.refundOriginal}
                    </button>
                  </div>
                </>
              ) : (
                <p className="member-booking-actions-warn">{c.notAllowed}</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
