/**
 * PayInvitePage - صفحة المشاركة في الدفع عبر رابط الدعوة
 * /pay-invite/:token
 * المدعو يسجّل بالبريد (كود تحقق) ثم يكمل البيانات ويُوجَّه لدفع الحصة (نادي / إلكتروني)
 */
import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getInviteByToken, recordPayment } from '../api/dbClient'
import { getAppLanguage } from '../storage/languageStorage'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { addMemberToClub } from '../storage/adminStorage'
import {
  normalizeInviteTokenParam,
  persistResumeInviteToken,
  readResumeInviteToken,
} from '../utils/paymentShareDeepLink'
import './PayInvitePage.css'

/** Base URL of the app (origin + base path) — works locally and on deployed domain */
function getAppBaseUrl() {
  if (typeof window === 'undefined') return ''
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || ''
  const path = (base || '').replace(/\/$/, '')
  return path ? `${window.location.origin}${path}` : window.location.origin
}

/** Phone to digits only for URL */
function phoneToDigits(phone) {
  if (!phone || typeof phone !== 'string') return ''
  return phone.replace(/\D/g, '')
}

/** Public club booking page path (matches React Router /clubs/:clubId) */
function clubPublicPath(clubId) {
  if (clubId == null || String(clubId).trim() === '') return '/'
  return `/clubs/${encodeURIComponent(String(clubId))}`
}

const PayInvitePage = () => {
  const navigate = useNavigate()
  const { token: tokenParam } = useParams()
  const tokenNorm = React.useMemo(() => normalizeInviteTokenParam(tokenParam), [tokenParam])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorStatus, setErrorStatus] = useState(null)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [markedPaid, setMarkedPaid] = useState(false)
  const language = getAppLanguage() || 'en'

  const loadInvite = React.useCallback(async () => {
    const stored = readResumeInviteToken()
    const candidates = [...new Set([tokenNorm, stored].filter(Boolean))]
    if (!candidates.length) {
      setLoading(false)
      setError('Token required')
      setErrorStatus(null)
      setData(null)
      return
    }
    setError(null)
    setErrorStatus(null)
    setLoading(true)
    let lastErr = null
    for (const t of candidates) {
      try {
        const d = await getInviteByToken(t)
        setData(d)
        setError(null)
        setErrorStatus(null)
        persistResumeInviteToken(d?.inviteToken || t)
        if (t !== tokenNorm) {
          navigate(`/pay-invite/${d?.inviteToken || t}`, { replace: true })
        }
        setLoading(false)
        return
      } catch (e) {
        lastErr = e
      }
    }
    setData(null)
    setError(lastErr?.message || 'Failed to load invite')
    setErrorStatus(
      lastErr?.status ?? (lastErr?.message && /fetch|network|failed to load/i.test(lastErr.message) ? 'network' : null)
    )
    setLoading(false)
  }, [tokenNorm, navigate])

  useEffect(() => {
    loadInvite()
  }, [loadInvite])

  const platformUser = getCurrentPlatformUser()
  const inviteAutoSyncRef = React.useRef(false)
  useEffect(() => {
    inviteAutoSyncRef.current = false
  }, [tokenNorm])

  useEffect(() => {
    const inviteTok = data?.inviteToken || tokenNorm
    if (!platformUser?.id || !data?.clubId || !inviteTok || inviteAutoSyncRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const bookingApi = await import('../api/dbClient')
        try {
          await bookingApi.joinClub(data.clubId, platformUser.id)
          await addMemberToClub(platformUser.id, data.clubId)
        } catch (_) {}
        try {
          await bookingApi.claimInviteShare({
            inviteToken: inviteTok,
            clubId: data.clubId,
            memberId: platformUser.id,
            phone: platformUser.mobile || platformUser.phone,
            memberName: platformUser.name
          })
        } catch (_) {}
        if (cancelled) return
        inviteAutoSyncRef.current = true
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('clubs-synced'))
        }
        loadInvite()
      } catch (_) {}
    })()
    return () => { cancelled = true }
  }, [platformUser?.id, data?.clubId, data?.inviteToken, tokenNorm, loadInvite])

  const t = (en, ar) => (language === 'ar' ? ar : en)

  if (loading) {
    return (
      <div className="pay-invite-page">
        <div className="pay-invite-card pay-invite-loading">
          <div className="pay-invite-spinner" aria-hidden />
          <p>{t('Loading...', 'جاري التحميل...')}</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    const is404 = errorStatus === 404
    const isNetwork = errorStatus === 'network' || (error && /fetch|network|failed to load/i.test(String(error)))
    const title = isNetwork
      ? t('Cannot reach server', 'لا يمكن الاتصال بالسيرفر')
      : t('Invite not found', 'لم يتم العثور على الدعوة')
    const message = isNetwork
      ? t('Make sure the API server is running (e.g. port 4000) and try again.', 'تأكد من تشغيل سيرفر واجهة برمجة التطبيقات (مثلاً المنفذ 4000) ثم أعد المحاولة.')
      : is404
        ? t('The link was not found. It is created when someone books a court, adds you to split the payment, and sends you the WhatsApp link.', 'الرابط غير موجود. يُنشأ عندما يحجز أحد ملعباً ويضيفك لمشاركة الدفع ثم يرسلك الرابط عبر واتساب.')
        : t('This link may have expired or is invalid. Make sure the API server is running and try again.', 'قد يكون الرابط منتهي الصلاحية أو غير صحيح. تأكد من تشغيل السيرفر ثم أعد المحاولة.')
    return (
      <div className="pay-invite-page">
        <div className="pay-invite-card pay-invite-error">
          <h1 className="pay-invite-title">{title}</h1>
          <p className="pay-invite-message">{message}</p>
          <div className="pay-invite-error-actions">
            <button type="button" className="pay-invite-btn pay-invite-btn-primary" onClick={() => loadInvite()}>
              {t('Retry', 'إعادة المحاولة')}
            </button>
            <Link to="/" className="pay-invite-btn pay-invite-btn-secondary">{t('Back to home', 'العودة للرئيسية')}</Link>
          </div>
        </div>
      </div>
    )
  }

  const baseUrl = getAppBaseUrl()
  const digits = phoneToDigits(data.phone || '')
  const canonicalInviteToken = data?.inviteToken || tokenNorm
  const returnTo = `/pay-invite/${canonicalInviteToken}`
  const registerQuery = new URLSearchParams()
  registerQuery.set('join', data.clubId || '')
  if (digits.length >= 8) registerQuery.set('phone', digits)
  registerQuery.set('returnTo', returnTo)
  const registerUrl = `${baseUrl}/register?${registerQuery.toString()}`
  const clubsUrl = `${baseUrl}/clubs/${encodeURIComponent(data.clubId || '')}`

  const handleMarkPaid = async () => {
    const inviteTok = data?.inviteToken || tokenNorm
    if (!inviteTok || !data?.clubId) return
    setMarkingPaid(true)
    try {
      await recordPayment({ inviteToken: inviteTok, clubId: data.clubId, paymentMethod: 'at_club' })
      setMarkedPaid(true)
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(e?.message || (language === 'ar' ? 'فشل في تسجيل الدفع' : 'Failed to record payment'))
      }
    } finally {
      setMarkingPaid(false)
    }
  }

  const bookingDate = data.bookingDate
    ? new Date(data.bookingDate + 'T12:00:00').toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : '—'
  const isPending = data?.bookingStatus === 'pending_payments' || data?.bookingStatus === 'partially_paid'
  const amountStr = `${parseFloat(data.amount || 0).toFixed(2)} ${t('SAR', 'ر.س')}`
  const chosePayAtClub = data?.paymentMethod === 'at_club' && !data?.paidAt

  return (
    <div className="pay-invite-page">
      <div className="pay-invite-card">
        {platformUser?.profileIncomplete ? (
          <div className="pay-invite-profile-banner" role="region" aria-live="polite">
            <p className="pay-invite-profile-banner-text">
              {t(
                'Please complete your member profile from the account menu when you can.',
                'يرجى استكمال بيانات العضوية من قائمة الحساب عندما تتاح لك الفرصة.'
              )}
            </p>
          </div>
        ) : null}
        <div className="pay-invite-badge">{t('Payment share', 'مشاركة في الدفع')}</div>
        <h1 className="pay-invite-title">
          {t("You're invited to participate", 'تمت دعوتك للمشاركة')}
        </h1>
        <p className="pay-invite-intro">
          {t(
            'You have been invited to share the cost of a court booking. Add your email and confirm it with the code we send you, then complete your account — you will go straight to payment (at the club or online). Your booking will appear under My Bookings (courts).',
            'تمت دعوتك للمشاركة في دفع حجز ملعب. أدخل بريدك وأكّده بالكود، ثم أكمل بياناتك — ستنتقل مباشرة للدفع (في النادي أو إلكترونياً). سيظهر الحجز في «حجوزاتي» ضمن جدول الملاعب.'
          )}
        </p>

        <dl className="pay-invite-details">
          <div className="pay-invite-detail-row">
            <dt>{t('Date', 'التاريخ')}</dt>
            <dd>{bookingDate}</dd>
          </div>
          <div className="pay-invite-detail-row">
            <dt>{t('Time', 'الوقت')}</dt>
            <dd>{data.startTime || '—'} – {data.endTime || '—'}</dd>
          </div>
          <div className="pay-invite-detail-row pay-invite-detail-amount">
            <dt>{t('Your share', 'حصتك')}</dt>
            <dd>{amountStr}</dd>
          </div>
        </dl>

        {!platformUser ? (
          <div className="pay-invite-actions">
            <a href={registerUrl} className="pay-invite-btn pay-invite-btn-primary">
              {t('Register with email and continue to payment', 'التسجيل بالبريد والمتابعة للدفع')}
            </a>
            <p className="pay-invite-hint">
              {t(
                'We will ask for your email first, send a verification code, then your name, mobile number, and password. After that you choose how to pay your share.',
                'نطلب بريدك أولاً ونرسل كود تحقق، ثم الاسم والجوال وكلمة المرور. بعد ذلك تختار طريقة دفع حصتك.'
              )}
            </p>
            <a
              href={`${baseUrl}/login?join=${encodeURIComponent(data.clubId || '')}&return=${encodeURIComponent(returnTo)}`}
              className="pay-invite-link-secondary"
            >
              {t('Already registered? Log in', 'مسجل مسبقاً؟ سجّل الدخول')}
            </a>
          </div>
        ) : (
          <div className="pay-invite-actions">
            {isPending && !markedPaid && (
              <div className="pay-invite-payment-section">
                <p className="pay-invite-payment-options-label">{t('Choose how to pay your share', 'اختر طريقة دفع حصتك')}</p>
                <div className="pay-invite-payment-cards">
                  <button
                    type="button"
                    className={`pay-invite-payment-card pay-invite-payment-card-at-club ${chosePayAtClub ? 'pay-invite-payment-card-chosen' : ''}`}
                    onClick={handleMarkPaid}
                    disabled={markingPaid || chosePayAtClub}
                    aria-pressed={chosePayAtClub}
                  >
                    <span className="pay-invite-payment-card-icon" aria-hidden>🏢</span>
                    {chosePayAtClub ? <span className="pay-invite-payment-card-check" aria-hidden>✓ </span> : null}
                    <span className="pay-invite-payment-card-title">{chosePayAtClub ? t('Chosen — pay at club', 'اخترتها — سأدفع في النادي') : t('Pay at club', 'الدفع في النادي')}</span>
                    <span className="pay-invite-payment-card-desc">{chosePayAtClub ? (language === 'ar' ? 'لا يمكن تغييرها إلا بالدفع الإلكتروني' : 'Cannot change except via electronic payment') : t('Cash or card at the club', 'كاش أو بطاقة في النادي')}</span>
                    {markingPaid && !chosePayAtClub && <span className="pay-invite-payment-card-loading">{t('Saving...', 'جاري الحفظ...')}</span>}
                  </button>
                  <Link to={`/pay-share/${canonicalInviteToken}`} className="pay-invite-payment-card pay-invite-payment-card-electronic">
                    <span className="pay-invite-payment-card-icon" aria-hidden>💳</span>
                    <span className="pay-invite-payment-card-title">{t('Pay electronically', 'الدفع الإلكتروني')}</span>
                    <span className="pay-invite-payment-card-desc">{t('Card or Mada online', 'بطاقة أو متاب أونلاين')}</span>
                  </Link>
                </div>
              </div>
            )}
            {markedPaid && (
              <div className="pay-invite-success">
                <span className="pay-invite-success-icon" aria-hidden>✓</span>
                <p>{t('Payment recorded. Thank you!', 'تم تسجيل الدفع. شكراً لك!')}</p>
              </div>
            )}
            {!isPending && !markedPaid && (
              <p className="pay-invite-message">{t('This share is already settled.', 'تم تسوية هذه المشاركة.')}</p>
            )}
          </div>
        )}

        <div className="pay-invite-completion-notice">
          <p>
            {t(
              'After payment, open the club page — a yellow notice will remind you to finish your member profile from your account menu.',
              'بعد الدفع، عند زيارة صفحة النادي تظهر لك تنبيهات صفراء لاستكمال بيانات عضويتك من قائمة حسابك.'
            )}
          </p>
        </div>
      </div>

      <p className="pay-invite-footer-link">
        <Link to={clubPublicPath(data.clubId)}>
          {data.clubId ? t('Open club page', 'صفحة النادي') : t('Back to home', 'العودة للرئيسية')}
        </Link>
      </p>
    </div>
  )
}

export default PayInvitePage
