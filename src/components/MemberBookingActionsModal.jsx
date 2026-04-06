/**
 * Member: reschedule court booking (fees + wallet) or request cancel/refund per club policy.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import * as bookingApi from '../api/dbClient'
import HalfHourTimeSelect from './HalfHourTimeSelect'
import './MemberBookingActionsModal.css'

export default function MemberBookingActionsModal({
  booking,
  club,
  platformUser,
  language,
  onClose,
  onUpdated,
  initialSection = 'reschedule',
  /** If set, member is a split invitee: only cancel/refund for this share (no reschedule). */
  splitShare = null,
}) {
  const [activeTab, setActiveTab] = useState(
    splitShare ? 'cancel' : initialSection === 'cancel' ? 'cancel' : 'reschedule'
  )
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
  const isTrainingBooking = booking?.type === 'training' || booking?.data?.type === 'training'
  /** تغيير الموعد غير متاح لتدريب المدرب من هذه النافذة؛ مشارك التقسيم يرى الإلغاء فقط */
  const hideReschedule = !!(splitShare || isTrainingBooking)

  useEffect(() => {
    if (hideReschedule) {
      setActiveTab('cancel')
      return
    }
    setActiveTab(initialSection === 'cancel' ? 'cancel' : 'reschedule')
  }, [initialSection, bookingId, hideReschedule, splitShare?.id, splitShare?.inviteToken])

  const t = {
    en: {
      title: 'Change or cancel booking',
      trainingRefundNote: 'Training session: you can request a refund per the club policy; changing the time is not available here.',
      tabReschedule: 'Reschedule',
      tabCancel: 'Cancel & refunds',
      tabCancelHint: 'Refund requests are handled by the club after you submit.',
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
      cancelUnpaidTitle: 'Cancel unpaid booking',
      cancelUnpaidHint: 'No completed payment on file. The slot will be released for others.',
      cancelUnpaidBtn: 'Cancel booking',
      cancelHint: 'Within the club cancellation window. Fees may apply.',
      refundWallet: 'Refund to my club wallet (after club confirms)',
      refundCash: 'Cash refund at club (after staff confirms)',
      refundElectronic: 'Card/bank refund (club processes reversal)',
      refundOutsideHint: 'Outside the automatic cancellation window — the club will confirm the final amount.',
      notAllowed: 'Not allowed at this time.',
      hoursLeft: 'Hours until start',
      success: 'Done.',
      close: 'Close',
      splitParticipantTitle: 'Your share — booking details & refund',
      splitRefundNetHint: 'Estimated refund applies to your paid share only.',
      splitRefundPending: 'A refund for your share is already requested. The club will complete it.',
      errSyncTitle: 'Sync in progress',
      errSyncHint:
        'Your booking data is being updated on the server. Wait a few seconds, then tap Try again. If it persists, close this window and open the booking again.',
      retry: 'Try again',
    },
    ar: {
      title: 'تعديل أو إلغاء الحجز',
      trainingRefundNote: 'حصة تدريب: يمكنك طلب الاسترداد وفق سياسة النادي؛ تغيير الموعد غير متاح من هنا.',
      tabReschedule: 'تغيير الموعد',
      tabCancel: 'الإلغاء واستعادة المبلغ',
      tabCancelHint: 'بعد إرسال الطلب، يعالج النادي مطالبة الاسترداد وفق سياساته.',
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
      cancelUnpaidTitle: 'إلغاء حجز بدون دفع مكتمل',
      cancelUnpaidHint: 'لا يوجد مبلغ مدفوع مكتمل. يُحرَّر الموعد لغيرك.',
      cancelUnpaidBtn: 'إلغاء الحجز',
      cancelHint: 'ضمن المهلة المسموحة من النادي. قد تُطبَّق رسوم.',
      refundWallet: 'استرداد إلى محفظتي (بعد تأكيد النادي)',
      refundCash: 'استرداد نقداً من النادي (بعد تأكيد الموظف)',
      refundElectronic: 'استرداد للبطاقة/البنك (يعالجه النادي إلكترونياً)',
      refundOutsideHint: 'خارج المهلة التلقائية — النادي يؤكد المبلغ النهائي.',
      notAllowed: 'غير مسموح حالياً.',
      hoursLeft: 'ساعات حتى بداية الحجز',
      success: 'تم.',
      close: 'إغلاق',
      splitParticipantTitle: 'حصتك — تفاصيل الحجز واسترداد المبلغ',
      splitRefundNetHint: 'التقدير يخص حصتك المدفوعة فقط.',
      splitRefundPending: 'سبق أن طلبت استرداد حصتك. سيُكمِل النادي الإجراء.',
      errSyncTitle: 'جاري المزامنة',
      errSyncHint:
        'يتم تحديث بيانات الحجز على الخادم. انتظر ثوانٍ ثم اضغط «إعادة المحاولة». إن استمرّت المشكلة، أغلق النافذة وأعد فتح الحجز.',
      retry: 'إعادة المحاولة',
    },
  }
  const c = t[language] || t.en

  const loadErrPresentation = useMemo(() => {
    if (!loadErr) return null
    const m = String(loadErr).toLowerCase()
    if (
      m.includes('unknown column') ||
      m.includes('member_refund') ||
      m.includes('schema is updating') ||
      m.includes('database migration required') ||
      m.includes('er_bad_field_error') ||
      m.includes('er_bad_field')
    ) {
      return { variant: 'schema', title: c.errSyncTitle, hint: c.errSyncHint }
    }
    return { variant: 'generic', title: null, hint: loadErr }
  }, [loadErr, c.errSyncTitle, c.errSyncHint])

  const loadQuote = useCallback(async () => {
    if (!clubId || !bookingId || !memberId) return
    setLoadErr(null)
    try {
      if (splitShare && (splitShare.id || splitShare.inviteToken)) {
        const q = await bookingApi.memberShareSelfServiceQuote({
          bookingId,
          clubId,
          memberId,
          shareId: splitShare.id || undefined,
          inviteToken: splitShare.inviteToken || undefined,
          phone: platformUser?.mobile || platformUser?.phone,
        })
        setQuote(q)
      } else {
        const q = await bookingApi.memberBookingSelfServiceQuote({ bookingId, clubId, memberId })
        setQuote(q)
      }
    } catch (e) {
      setLoadErr(e?.message || 'Error')
      setQuote(null)
    }
  }, [clubId, bookingId, memberId, splitShare?.id, splitShare?.inviteToken, platformUser?.mobile, platformUser?.phone])

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
    const confirmMsg = splitShare
      ? language === 'ar'
        ? 'تأكيد طلب استرداد حصتك (بعد موافقة النادي)؟'
        : 'Request a refund for your share? The club will process it.'
      : language === 'ar'
        ? 'تأكيد إلغاء الحجز وطلب الاسترداد؟'
        : 'Cancel this booking and request a refund?'
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return
    setBusy(true)
    setLoadErr(null)
    try {
      if (splitShare) {
        await bookingApi.memberRequestShareRefund({
          bookingId,
          clubId,
          memberId,
          shareId: splitShare.id || undefined,
          inviteToken: splitShare.inviteToken || undefined,
          refundRoute,
          phone: platformUser?.mobile || platformUser?.phone,
        })
      } else {
        await bookingApi.memberRefundRequest({ bookingId, clubId, memberId, refundRoute })
      }
      onUpdated?.()
      if (typeof window !== 'undefined' && window.alert) window.alert(c.success)
      onClose?.()
    } catch (e) {
      setLoadErr(e?.message || (language === 'ar' ? 'فشل الطلب' : 'Request failed'))
    } finally {
      setBusy(false)
    }
  }

  const handleSimpleCancelUnpaid = async () => {
    if (!bookingId) return
    if (typeof window !== 'undefined' && !window.confirm(language === 'ar' ? 'تأكيد إلغاء الحجز؟' : 'Cancel this booking?')) return
    setBusy(true)
    setLoadErr(null)
    try {
      await bookingApi.cancelBooking(bookingId)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      onUpdated?.()
      if (typeof window !== 'undefined' && window.alert) window.alert(c.success)
      onClose?.()
    } catch (e) {
      setLoadErr(e?.message || (language === 'ar' ? 'فشل الإلغاء' : 'Cancellation failed'))
    } finally {
      setBusy(false)
    }
  }

  if (!booking || !club || !platformUser) return null

  return (
    <div className="member-booking-actions-backdrop" onClick={onClose} role="presentation">
      <div className="member-booking-actions-modal" role="dialog" aria-modal="true" aria-labelledby="member-booking-actions-title" onClick={(e) => e.stopPropagation()}>
        <div className="member-booking-actions-head">
          <h3 id="member-booking-actions-title">{splitShare ? c.splitParticipantTitle : c.title}</h3>
          <button type="button" className="member-booking-actions-close" onClick={onClose} aria-label={c.close}>×</button>
        </div>
        {loadErrPresentation && (
          <div
            className={`member-booking-actions-err member-booking-actions-err--${loadErrPresentation.variant}`}
            role="alert"
          >
            <div className="member-booking-actions-err-inner">
              <span className="member-booking-actions-err-ico" aria-hidden>
                {loadErrPresentation.variant === 'schema' ? '⏳' : '⚠️'}
              </span>
              <div className="member-booking-actions-err-copy">
                {loadErrPresentation.variant === 'schema' ? (
                  <>
                    <strong className="member-booking-actions-err-title">{loadErrPresentation.title}</strong>
                    <p className="member-booking-actions-err-desc">{loadErrPresentation.hint}</p>
                  </>
                ) : (
                  <p className="member-booking-actions-err-desc">{loadErrPresentation.hint}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              className="member-booking-actions-err-retry"
              onClick={() => loadQuote()}
              disabled={busy}
            >
              {c.retry}
            </button>
          </div>
        )}
        {!quote && !loadErr && <p className="member-booking-actions-muted member-booking-actions-body">{c.loading}</p>}
        {quote && (
          <div className="member-booking-actions-body">
            <p className="member-booking-actions-wallet">
              {c.wallet}: <strong>{quote.walletBalance?.toFixed ? quote.walletBalance.toFixed(2) : quote.walletBalance} {currency}</strong>
            </p>
            {!hideReschedule ? (
            <div className="member-booking-actions-tabs" role="tablist" aria-label={c.title}>
              <button
                type="button"
                role="tab"
                id="mba-tab-reschedule"
                aria-selected={activeTab === 'reschedule'}
                aria-controls="mba-panel-reschedule"
                className={`member-booking-actions-tab ${activeTab === 'reschedule' ? 'member-booking-actions-tab--active' : ''}`}
                onClick={() => setActiveTab('reschedule')}
              >
                {c.tabReschedule}
              </button>
              <button
                type="button"
                role="tab"
                id="mba-tab-cancel"
                aria-selected={activeTab === 'cancel'}
                aria-controls="mba-panel-cancel"
                className={`member-booking-actions-tab ${activeTab === 'cancel' ? 'member-booking-actions-tab--active' : ''}`}
                onClick={() => setActiveTab('cancel')}
              >
                {c.tabCancel}
              </button>
            </div>
            ) : null}
            <p className="member-booking-actions-tab-hint">
              {splitShare ? c.tabCancelHint : activeTab === 'reschedule' ? c.feeHint : c.tabCancelHint}
            </p>

            {!splitShare && activeTab === 'reschedule' && (
              <section id="mba-panel-reschedule" role="tabpanel" aria-labelledby="mba-tab-reschedule" className="member-booking-actions-panel">
                <h4 className="member-booking-actions-sr-only">{c.rescheduleTitle}</h4>
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
                    <HalfHourTimeSelect
                      value={startTime}
                      onChange={setStartTime}
                      className="member-booking-actions-input"
                      settings={club?.settings}
                      isoDate={dateStr}
                    />
                  </label>
                  <label>
                    {c.end}
                    <HalfHourTimeSelect
                      value={endTime}
                      onChange={setEndTime}
                      className="member-booking-actions-input"
                      settings={club?.settings}
                      isoDate={dateStr}
                    />
                  </label>
                </div>
                <button type="button" className="member-booking-actions-primary" disabled={busy} onClick={handleReschedule}>
                  {busy ? '…' : c.apply}
                </button>
              </section>
            )}

            {(splitShare || hideReschedule || activeTab === 'cancel') && (
              <section id="mba-panel-cancel" role="tabpanel" aria-labelledby="mba-tab-cancel" className="member-booking-actions-panel member-booking-actions-panel--danger">
                <h4>{c.cancelTitle}</h4>
                <p className="member-booking-actions-muted">{c.cancelHint}</p>
                {splitShare && (
                  <p className="member-booking-actions-muted member-booking-actions-split-hint">{c.splitRefundNetHint}</p>
                )}
                {quote.hoursUntilStart != null && (
                  <p className="member-booking-actions-muted">{c.hoursLeft}: {quote.hoursUntilStart.toFixed(1)}</p>
                )}
                {splitShare && quote.memberRefundPending ? (
                  <p className="member-booking-actions-warn">{c.splitRefundPending}</p>
                ) : null}
                {!splitShare && quote.cancelAllowed && (quote.paidAmount || 0) <= 0.01 ? (
                  <>
                    <p className="member-booking-actions-muted">{c.cancelUnpaidHint}</p>
                    <p className="member-booking-actions-unpaid-note">{c.cancelUnpaidTitle}</p>
                    <button type="button" className="member-booking-actions-danger" disabled={busy} onClick={handleSimpleCancelUnpaid}>
                      {busy ? '…' : c.cancelUnpaidBtn}
                    </button>
                  </>
                ) : (quote.cancelAllowed || quote.canRequestRefundCancel) && (quote.paidAmount || 0) > 0.01 ? (
                  <>
                    {!quote.cancelAllowed && quote.canRequestRefundCancel ? (
                      <p className="member-booking-actions-warn">
                        {c.refundOutsideHint}
                      </p>
          ) : null}
                    <p className="member-booking-actions-fee">
                      {splitShare
                        ? language === 'ar'
                          ? 'صافي استرداد حصتك (تقريبي)'
                          : 'Estimated net refund (your share)'
                        : language === 'ar'
                          ? 'صافي الاسترداد التقريبي'
                          : 'Estimated net refund'}
                      :{' '}
                      <strong>{quote.estimatedRefundNet} {currency}</strong>
                      {quote.cancelFee > 0 ? <span> ({language === 'ar' ? 'بعد خصم' : 'after fee'} {quote.cancelFee})</span> : null}
                    </p>
                    <p className="member-booking-actions-muted member-booking-actions-refund-flow-hint">
                      {quote.allowElectronicRefundRoute
                        ? language === 'ar'
                          ? 'بعد الطلب، يؤكد النادي تسليم المبلغ أو إضافته للمحفظة أو إتمام الاسترداد الإلكتروني.'
                          : 'After you submit, the club will confirm cash payout, wallet credit, or electronic refund.'
                        : language === 'ar'
                          ? 'بعد الطلب، يؤكد النادي تسليم المبلغ نقداً أو إضافته للمحفظة (الدفع كان في النادي).'
                          : 'After you submit, the club will confirm cash payout or wallet credit (you paid at the club).'}
                    </p>
                    {!quote.memberRefundPending && (
                    <div className="member-booking-actions-refund-btns">
                      <button type="button" className="member-booking-actions-secondary" disabled={busy} onClick={() => handleRefund('wallet')}>
                        {c.refundWallet}
                      </button>
                      <button type="button" className="member-booking-actions-secondary" disabled={busy} onClick={() => handleRefund('cash')}>
                        {c.refundCash}
                      </button>
                      {quote.allowElectronicRefundRoute ? (
                        <button type="button" className="member-booking-actions-secondary" disabled={busy} onClick={() => handleRefund('electronic')}>
                          {c.refundElectronic}
                        </button>
                      ) : null}
                    </div>
                    )}
                  </>
                ) : !splitShare && !quote.canRequestRefundCancel && (quote.paidAmount || 0) > 0.01 ? (
                  <p className="member-booking-actions-warn">{c.notAllowed}</p>
                ) : !splitShare && (quote.paidAmount || 0) > 0.01 ? (
                  <p className="member-booking-actions-warn">{c.notAllowed}</p>
                ) : !splitShare && !quote.cancelAllowed ? (
                  <p className="member-booking-actions-warn">{c.notAllowed}</p>
                ) : splitShare && !quote.memberRefundPending && !quote.canRequestRefundCancel && (quote.paidAmount || 0) > 0.01 ? (
                  <p className="member-booking-actions-warn">{c.notAllowed}</p>
                ) : null}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
