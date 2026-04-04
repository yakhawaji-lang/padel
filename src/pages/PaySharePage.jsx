/**
 * PaySharePage - صفحة الدفع الإلكتروني لحصة المشاركة
 * /pay-share/:token
 * يسمح للمشارك بدفع حصته إما في النادي أو إلكترونياً
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getInviteByToken, recordPayment, getWalletBalance } from '../api/dbClient'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import './PaymentPage.css'
import { UnifiedPaymentActionGrid } from '../components/UnifiedPaymentOptions'

const SHARE_FETCH_MS = 28000

function readPaySharePageLanguage() {
  try {
    const l = String(typeof document !== 'undefined' ? document.documentElement?.lang : 'en').toLowerCase()
    if (l.startsWith('ar')) return 'ar'
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('playtix_app_language') : null
    if (raw) {
      const p = JSON.parse(raw)
      if (p === 'ar' || p === 'en') return p
    }
  } catch (_) {}
  return 'en'
}

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

function clubPublicPath(clubId) {
  if (clubId == null || String(clubId).trim() === '') return '/'
  return `/clubs/${encodeURIComponent(String(clubId))}`
}

const formatDate = (dateStr, lang) => {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

const PaySharePage = () => {
  const { token } = useParams()
  const navigate = useNavigate()
  const language = readPaySharePageLanguage()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [walletBal, setWalletBal] = useState(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const platformUser = getCurrentPlatformUser()
  const shareSyncRef = React.useRef(false)

  const loadInvite = useCallback(() => {
    if (!token) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const to = setTimeout(
        () => reject(Object.assign(new Error('Request timeout'), { status: 'network' })),
        SHARE_FETCH_MS
      )
      getInviteByToken(token).then(
        (d) => {
          clearTimeout(to)
          setData(d)
          setError(null)
          resolve(d)
        },
        (e) => {
          clearTimeout(to)
          setError(e?.message || 'Failed to load invite')
          reject(e)
        }
      )
    }).catch(() => {})
  }, [token])

  useEffect(() => {
    shareSyncRef.current = false
  }, [token])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('Token required')
      return
    }
    setLoading(true)
    loadInvite().finally(() => setLoading(false))
  }, [token, loadInvite])

  useEffect(() => {
    if (!platformUser?.id || !data?.clubId || !token || shareSyncRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const bookingApi = await import('../api/dbClient')
        try {
          await bookingApi.joinClub(data.clubId, platformUser.id)
          const admin = await import('../storage/adminStorage.js')
          await admin.addMemberToClub(platformUser.id, data.clubId)
        } catch (_) {}
        try {
          await bookingApi.claimInviteShare({
            inviteToken: token,
            clubId: data.clubId,
            memberId: platformUser.id,
            phone: platformUser.mobile || platformUser.phone,
            memberName: platformUser.name
          })
        } catch (_) {}
        if (cancelled) return
        shareSyncRef.current = true
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('clubs-synced'))
        }
        await loadInvite()
      } catch (_) {}
    })()
    return () => { cancelled = true }
  }, [platformUser?.id, data?.clubId, token, loadInvite])

  useEffect(() => {
    if (!platformUser?.id || !data?.clubId) {
      setWalletBal(null)
      setWalletLoading(false)
      return
    }
    let c = false
    setWalletLoading(true)
    getWalletBalance(data.clubId, platformUser.id)
      .then((r) => {
        if (c) return
        const n = typeof r?.balance === 'number' ? r.balance : parseFloat(r?.balance)
        setWalletBal(Number.isFinite(n) ? n : 0)
      })
      .catch(() => {
        if (!c) setWalletBal(0)
      })
      .finally(() => {
        if (!c) setWalletLoading(false)
      })
    return () => {
      c = true
    }
  }, [platformUser?.id, data?.clubId, data?.paidAt])

  const handlePayAtClub = async () => {
    if (!token || !data?.clubId) return
    setSubmitting(true)
    setError(null)
    try {
      await recordPayment({ inviteToken: token, clubId: data.clubId, paymentMethod: 'at_club' })
      setSuccess(true)
      setTimeout(() => navigate('/my-bookings?payment=success'), 2000)
    } catch (e) {
      setError(e?.message || (language === 'ar' ? 'فشل تسجيل الدفع' : 'Failed to record payment'))
    } finally {
      setSubmitting(false)
    }
  }

  const handlePayWallet = async () => {
    if (!token || !data?.clubId) return
    setSubmitting(true)
    setError(null)
    try {
      await recordPayment({ inviteToken: token, clubId: data.clubId, paymentMethod: 'wallet' })
      setSuccess(true)
      setTimeout(() => navigate('/my-bookings?payment=success'), 2000)
    } catch (e) {
      setError(e?.message || (language === 'ar' ? 'فشل الدفع من المحفظة' : 'Wallet payment failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handlePayElectronically = async (e) => {
    e?.preventDefault?.()
    if (!token || !data?.clubId) return
    setSubmitting(true)
    setError(null)
    try {
      const paymentReference = `online_${Date.now()}`
      await recordPayment({ inviteToken: token, clubId: data.clubId, paymentReference, paymentMethod: 'electronic' })
      setSuccess(true)
      setTimeout(() => navigate('/my-bookings?payment=success'), 2000)
    } catch (e) {
      setError(e?.message || (language === 'ar' ? 'فشل الدفع. حاول مجدداً.' : 'Payment failed. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const c = {
    title: t('Pay your share', 'ادفع حصتك', language),
    payAtClub: t('Pay at club', 'الدفع في النادي', language),
    payAtClubDesc: t('Pay with cash or card at the club', 'الدفع نقداً أو بالبطاقة في النادي', language),
    payElectronic: t('Pay electronically', 'الدفع الإلكتروني', language),
    payElectronicDesc: t('Pay with card or Mada online', 'الدفع بالبطاقة أو متاب أونلاين', language),
    amount: t('Your share', 'حصتك', language),
    success: t('Payment recorded! Redirecting...', 'تم تسجيل الدفع! جاري التحويل...', language),
    backToHome: t('Back to home', 'العودة للرئيسية', language),
    openClubPage: t('Open club page', 'صفحة النادي', language),
    myBookings: t('My bookings', 'حجوزاتي', language),
    loading: t('Loading...', 'جاري التحميل...', language),
    notFound: t('Invite not found', 'الدعوة غير موجودة', language),
    loginRequired: t('Please log in to pay.', 'يرجى تسجيل الدخول للدفع.', language),
    payNow: t('Pay now', 'ادفع الآن', language),
    processing: t('Processing...', 'جاري المعالجة...', language),
    chosenPayAtClub: t('Chosen — pay at club', 'اخترتها — سأدفع في النادي', language),
    switchToElectronic: t('Switch to electronic payment', 'التبديل إلى الدفع الإلكتروني', language),
    newHere: t('New to PlayTix?', 'جديد على PlayTix؟', language),
    startWithInvite: t('Open the invite page to register with email', 'افتح صفحة الدعوة للتسجيل بالبريد', language),
  }

  if (loading) {
    return (
      <div className="payment-page">
        <div className="payment-card payment-loading">
          <div className="payment-spinner" aria-hidden />
          <p>{c.loading}</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="payment-page">
        <div className="payment-card payment-error">
          <h1 className="payment-title">{c.notFound}</h1>
          <p className="payment-message">{error}</p>
          <Link to="/" className="payment-btn payment-btn-secondary">{c.backToHome}</Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="payment-page">
        <div className="payment-card payment-error">
          <h1 className="payment-title">{c.notFound}</h1>
          <Link to="/" className="payment-btn payment-btn-secondary">{c.backToHome}</Link>
        </div>
      </div>
    )
  }

  if (!platformUser) {
    const loginQs = new URLSearchParams()
    if (data.clubId) loginQs.set('join', data.clubId)
    loginQs.set('return', `/pay-share/${token}`)
    const loginTo = `/login?${loginQs.toString()}`
    return (
      <div className="payment-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="payment-card">
          <h1 className="payment-title">{c.loginRequired}</h1>
          <p className="payment-message" style={{ marginBottom: 20 }}>
            {formatDate(data.bookingDate, language)} · {data.startTime || '—'} – {data.endTime || '—'}
            <br />
            <strong>{c.amount}: {parseFloat(data.amount || 0).toFixed(2)} {t('SAR', 'ر.س')}</strong>
          </p>
          <Link to={loginTo} className="payment-btn payment-btn-primary">
            {language === 'ar' ? 'تسجيل الدخول' : 'Log in'}
          </Link>
          <p className="payment-share-guest-hint">{c.newHere}</p>
          <Link to={`/pay-invite/${token}`} className="payment-btn payment-btn-secondary payment-share-register-link">
            {c.startWithInvite}
          </Link>
          <Link to={clubPublicPath(data?.clubId)} className="payment-link-secondary" style={{ display: 'block', marginTop: 16 }}>
            {data?.clubId ? c.openClubPage : c.backToHome}
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="payment-page">
        <div className="payment-card payment-success">
          <div className="payment-success-icon">✓</div>
          <h1 className="payment-title">{c.success}</h1>
          <Link to="/my-bookings" className="payment-btn payment-btn-primary">{c.myBookings}</Link>
        </div>
      </div>
    )
  }

  const amountStr = `${parseFloat(data?.amount || 0).toFixed(2)} ${t('SAR', 'ر.س')}`
  const isPending = data?.bookingStatus === 'pending_payments' || data?.bookingStatus === 'partially_paid'
  const paidAt = data?.paidAt
  const paymentMethod = data?.paymentMethod
  const chosePayAtClub = paymentMethod === 'at_club' && !paidAt

  if (!isPending) {
    return (
      <div className="payment-page">
        <div className="payment-card">
          <h1 className="payment-title">{t('Share already settled', 'تم تسوية الحصة', language)}</h1>
          <Link to="/my-bookings" className="payment-btn payment-btn-primary">{c.myBookings}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="payment-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="payment-card">
        {platformUser?.profileIncomplete ? (
          <div className="payment-profile-banner" role="region" aria-live="polite">
            <p className="payment-profile-banner-text">
              {language === 'ar'
                ? 'يرجى استكمال بيانات العضوية من قائمة الحساب عندما تتاح لك الفرصة.'
                : 'Please complete your member profile from the account menu when you can.'}
            </p>
          </div>
        ) : null}
        <h1 className="payment-title">{c.title}</h1>

        <dl className="payment-details">
          <div className="payment-detail-row">
            <dt>{t('Date', 'التاريخ', language)}</dt>
            <dd>{formatDate(data?.bookingDate, language)}</dd>
          </div>
          <div className="payment-detail-row">
            <dt>{t('Time', 'الوقت', language)}</dt>
            <dd>{data?.startTime || '—'} – {data?.endTime || '—'}</dd>
          </div>
          <div className="payment-detail-row payment-detail-amount">
            <dt>{c.amount}</dt>
            <dd>{amountStr}</dd>
          </div>
        </dl>

        <p className="payment-options-label">{t('Choose payment method', 'اختر طريقة الدفع', language)}</p>

        <UnifiedPaymentActionGrid
          language={language}
          layoutRow
          atClubChosen={chosePayAtClub}
          atClubTitle={chosePayAtClub ? c.chosenPayAtClub : c.payAtClub}
          atClubDesc={c.payAtClubDesc}
          onPayAtClub={handlePayAtClub}
          atClubDisabled={submitting}
          atClubBusy={submitting}
          electronicOnClick={handlePayElectronically}
          electronicDisabled={submitting}
          electronicTitle={chosePayAtClub ? c.switchToElectronic : c.payElectronic}
          electronicDesc={c.payElectronicDesc}
          onPayWallet={handlePayWallet}
          walletDisabled={walletLoading || (walletBal != null && walletBal + 1e-9 < (parseFloat(data?.amount) || 0))}
          walletBusy={submitting}
        />

        {error && <p className="payment-error-msg">{error}</p>}

        {submitting && <p className="payment-processing">{c.processing}</p>}

        <Link to={`/pay-invite/${token}`} className="payment-link-secondary">{t('Back to invite', 'العودة للدعوة', language)}</Link>
      </div>
    </div>
  )
}

export default PaySharePage
