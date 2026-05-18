/**
 * دفع إلكتروني لحصة عضو في بطولة — يحدّث memberAck في tournamentData
 * Route: /pay/tournament-member/:clubId/:bookingId?memberId=
 */
import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getClubById, updateTournamentMemberPaymentEntry, loadClubs, refreshClubsFromApi } from '../storage/adminStorage'
import { getTournamentMemberPaymentEntry } from '../utils/tournamentHelpers'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getAppLanguage } from '../storage/languageStorage'
import './PaymentPage.css'
import { UnifiedPaymentActionGrid, getUnifiedPaymentCopy } from '../components/UnifiedPaymentOptions'
import { getGeideaPublicConfig, payBookingWithGeidea } from '../payments/geideaCheckout'

export default function TournamentMemberPayPage() {
  const { clubId, bookingId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const language = getAppLanguage() || 'en'
  const platformUser = getCurrentPlatformUser()
  const memberIdParam = searchParams.get('memberId')
  const effectiveMemberId = memberIdParam || platformUser?.id

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const resolved = useMemo(() => {
    if (!clubId || !bookingId) {
      return { error: language === 'ar' ? 'رابط غير صالح' : 'Invalid link', club: null, entry: null }
    }
    const club = getClubById(clubId)
    if (!club) {
      return { error: language === 'ar' ? 'النادي غير موجود' : 'Club not found', club: null, entry: null }
    }
    const booking = { id: bookingId, isTournament: true }
    const entry = effectiveMemberId ? getTournamentMemberPaymentEntry(club, booking, effectiveMemberId) : null
    if (!entry) {
      return {
        error: language === 'ar' ? 'لا توجد حصة مسجلة لهذا الحجز.' : 'No registered share for this booking.',
        club,
        entry: null,
      }
    }
    if (entry.clubReceived || entry.memberAck) {
      return {
        error: language === 'ar' ? 'تم تسجيل الدفع مسبقاً.' : 'Payment is already recorded.',
        club,
        entry,
      }
    }
    return { error: null, club, entry }
  }, [clubId, bookingId, effectiveMemberId, language])

  const amount = parseFloat(String(resolved.entry?.fee || '').replace(',', '.')) || 0
  const currency = resolved.club?.settings?.currency || 'SAR'

  const electronicHashHref =
    `/pay/tournament-member/${clubId}/${bookingId}?memberId=${encodeURIComponent(String(effectiveMemberId || ''))}#tournament-pay-electronic`

  const handlePayAtClubTournament = async () => {
    if (!clubId || !bookingId || !effectiveMemberId || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const ok = await updateTournamentMemberPaymentEntry(clubId, bookingId, effectiveMemberId, { paymentMethod: 'at_club' })
      if (!ok) {
        setError(language === 'ar' ? 'فشل التحديث.' : 'Update failed.')
        return
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      try {
        await refreshClubsFromApi()
        loadClubs()
      } catch (_) {}
      navigate('/my-bookings')
    } catch (err) {
      setError(err?.message || (language === 'ar' ? 'فشل' : 'Failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const c = {
    title: language === 'ar' ? 'دفع حصة البطولة' : 'Tournament share payment',
    amount: language === 'ar' ? 'المبلغ' : 'Amount',
    payNow: language === 'ar' ? 'تأكيد الدفع الإلكتروني' : 'Confirm electronic payment',
    success: language === 'ar' ? 'تم التسجيل! جاري التحويل…' : 'Recorded! Redirecting…',
    myBookings: language === 'ar' ? 'حجوزاتي' : 'My bookings',
    back: language === 'ar' ? 'رجوع' : 'Back',
    login: language === 'ar' ? 'تسجيل الدخول' : 'Log in',
    loginRequired: language === 'ar' ? 'يرجى تسجيل الدخول.' : 'Please log in.',
    hint: language === 'ar'
      ? 'تجريبي: لا يتم خصم مبلغ فعلي؛ يُسجَّل أنك أكملت الدفع الإلكتروني لحصتك. يمكن للنادي التحقق من حسابك.'
      : 'Simulated: no real charge; your share is marked paid electronically. The club can verify from their dashboard.',
  }

  const returnPath = `/pay/tournament-member/${clubId}/${bookingId}${memberIdParam ? `?memberId=${encodeURIComponent(memberIdParam)}` : ''}`

  if (!platformUser) {
    return (
      <div className="payment-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="payment-card payment-error">
          <h1 className="payment-title">{c.loginRequired}</h1>
          <div className="payment-actions">
            <Link to={`/login?return=${encodeURIComponent(returnPath)}`} className="payment-btn payment-btn-primary">{c.login}</Link>
            <Link to="/my-bookings" className="payment-btn payment-btn-secondary">{c.myBookings}</Link>
          </div>
        </div>
      </div>
    )
  }

  if (memberIdParam && String(platformUser.id) !== String(memberIdParam)) {
    return (
      <div className="payment-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="payment-card payment-error">
          <h1 className="payment-title">{language === 'ar' ? 'غير مصرح' : 'Not allowed'}</h1>
          <Link to="/my-bookings" className="payment-btn payment-btn-secondary">{c.myBookings}</Link>
        </div>
      </div>
    )
  }

  if (resolved.error && !resolved.entry) {
    return (
      <div className="payment-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="payment-card payment-error">
          <p className="payment-message">{resolved.error}</p>
          <Link to="/my-bookings" className="payment-btn payment-btn-primary">{c.myBookings}</Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="payment-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="payment-card payment-success">
          <div className="payment-success-icon">✓</div>
          <h1 className="payment-title">{c.success}</h1>
          <Link to="/my-bookings?payment=success" className="payment-btn payment-btn-primary">{c.myBookings}</Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clubId || !bookingId || !effectiveMemberId || submitting) return
    if (amount <= 0) {
      setError(language === 'ar' ? 'المبلغ غير محدد. تواصل مع النادي.' : 'Amount not set. Contact the club.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // Try real Geidea checkout if configured/enabled
      try {
        const cfg = await getGeideaPublicConfig()
        if (cfg?.configured && cfg?.enabled) {
          if (typeof window !== 'undefined') window.__PLAYTIX_GEIDEA__ = true
          const result = await payBookingWithGeidea({ bookingId })
          if (result?.status === 'cancel') {
            setError(language === 'ar' ? 'تم إلغاء عملية الدفع.' : 'Payment was cancelled.')
            return
          }
          if (result?.status !== 'success') {
            const msg = result?.data?.responseMessage || result?.data?.message
            setError(msg || (language === 'ar' ? 'فشل الدفع. حاول مجدداً.' : 'Payment failed. Please try again.'))
            return
          }
        }
      } catch (gErr) {
        const code = gErr?.code
        if (code !== 'GEIDEA_NOT_CONFIGURED' && code !== 'GEIDEA_DISABLED') {
          setError(gErr?.message || (language === 'ar' ? 'فشل الدفع الإلكتروني.' : 'Electronic payment failed.'))
          return
        }
      }
      const ok = await updateTournamentMemberPaymentEntry(clubId, bookingId, effectiveMemberId, {
        paymentMethod: 'electronic',
        memberAck: true,
      })
      if (!ok) {
        setError(language === 'ar' ? 'فشل التحديث.' : 'Update failed.')
        return
      }
      setSuccess(true)
      setTimeout(() => navigate('/my-bookings?payment=success'), 1200)
    } catch (err) {
      setError(err?.message || (language === 'ar' ? 'فشل' : 'Failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const alreadyDoneMsg = resolved.error && resolved.entry && (resolved.entry.clubReceived || resolved.entry.memberAck)

  return (
    <div className="payment-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="payment-card">
        <h1 className="payment-title">{c.title}</h1>
        <dl className="payment-details">
          <div className="payment-detail-row payment-detail-amount">
            <dt>{c.amount}</dt>
            <dd>{amount > 0 ? `${amount.toFixed(2)} ${currency}` : '—'}</dd>
          </div>
        </dl>
        {!alreadyDoneMsg && (
          <UnifiedPaymentActionGrid
            language={language}
            layoutRow
            onPayAtClub={handlePayAtClubTournament}
            atClubDisabled={submitting}
            atClubBusy={submitting}
            electronicHref={electronicHashHref}
            walletHint={getUnifiedPaymentCopy(language).walletUnavailableTournament}
          />
        )}
        {alreadyDoneMsg ? <p className="payment-message">{resolved.error}</p> : null}
        <form id="tournament-pay-electronic" onSubmit={handleSubmit} className="payment-form">
          {error && <p className="payment-error-msg">{error}</p>}
          <button type="submit" className="payment-btn payment-btn-primary payment-btn-submit" disabled={submitting || amount <= 0 || alreadyDoneMsg}>
            {submitting ? '…' : c.payNow}
          </button>
        </form>
        <p className="payment-hint">{c.hint}</p>
        <Link to="/my-bookings" className="payment-link-secondary">{c.back}</Link>
      </div>
    </div>
  )
}
