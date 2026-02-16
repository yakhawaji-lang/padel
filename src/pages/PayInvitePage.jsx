/**
 * PayInvitePage - صفحة المشاركة في الدفع عبر رابط الدعوة
 * /pay-invite/:token
 * توجه المدعو للتسجيل برقم الجوال فقط (كلمة سر مؤقتة = رقم الجوال) ثم الموافقة على المشاركة
 */
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getInviteByToken, recordPayment } from '../api/dbClient'
import { getAppLanguage } from '../storage/languageStorage'
import { getCurrentPlatformUser } from '../storage/platformAuth'
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

const PayInvitePage = () => {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorStatus, setErrorStatus] = useState(null)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [markedPaid, setMarkedPaid] = useState(false)
  const language = getAppLanguage() || 'en'

  const loadInvite = React.useCallback(() => {
    if (!token) {
      setLoading(false)
      setError('Token required')
      setErrorStatus(null)
      return
    }
    setError(null)
    setErrorStatus(null)
    setLoading(true)
    getInviteByToken(token)
      .then(d => {
        setData(d)
        setError(null)
        setErrorStatus(null)
      })
      .catch(e => {
        setError(e?.message || 'Failed to load invite')
        setErrorStatus(e?.status ?? (e?.message && /fetch|network|failed to load/i.test(e.message) ? 'network' : null))
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    loadInvite()
  }, [loadInvite])

  const platformUser = getCurrentPlatformUser()

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
  const returnTo = `/pay-invite/${token}`
  const registerQuery = new URLSearchParams()
  registerQuery.set('join', data.clubId || '')
  if (digits.length >= 8) registerQuery.set('phone', digits)
  registerQuery.set('returnTo', returnTo)
  const registerUrl = `${baseUrl}/register?${registerQuery.toString()}`
  const clubsUrl = `${baseUrl}/clubs/${encodeURIComponent(data.clubId || '')}`

  const handleMarkPaid = async () => {
    if (!token || !data?.clubId) return
    setMarkingPaid(true)
    try {
      await recordPayment({ inviteToken: token, clubId: data.clubId })
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

  return (
    <div className="pay-invite-page">
      <div className="pay-invite-card">
        <div className="pay-invite-badge">{t('Payment share', 'مشاركة في الدفع')}</div>
        <h1 className="pay-invite-title">
          {t("You're invited to participate", 'تمت دعوتك للمشاركة')}
        </h1>
        <p className="pay-invite-intro">
          {t(
            'You have been invited to share the cost of a court booking. Register with your phone number, then confirm your participation.',
            'تمت دعوتك للمشاركة في دفع حجز ملعب. سجّل برقم جوالك ثم أكّد مشاركتك.'
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
              {data.phone
                ? t('Register with my number and participate', 'التسجيل برقمي والمشاركة')
                : t('Register with phone and participate', 'التسجيل بالجوال والمشاركة')}
            </a>
            <p className="pay-invite-hint">
              {t('Only your phone number is needed. Your temporary password will be the same as your phone number.', 'يكفي رقم الجوال. كلمة المرور المؤقتة = نفس رقم الجوال.')}
            </p>
            <a href={`${baseUrl}/login?return=${encodeURIComponent(returnTo)}`} className="pay-invite-link-secondary">
              {t('Already registered? Log in', 'مسجل مسبقاً؟ سجّل الدخول')}
            </a>
          </div>
        ) : (
          <div className="pay-invite-actions">
            {isPending && !markedPaid && (
              <button type="button" className="pay-invite-btn pay-invite-btn-confirm" onClick={handleMarkPaid} disabled={markingPaid}>
                {markingPaid ? t('Saving...', 'جاري الحفظ...') : t("I've paid my share — confirm", 'قمت بدفع حصتي — تأكيد')}
              </button>
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
              'You can complete your profile later (e.g. set a permanent password, add email) from your account or after payment.',
              'يمكنك إكمال بيانات حسابك لاحقاً (مثل كلمة مرور دائمة أو البريد) من حسابك أو بعد الدفع.'
            )}
          </p>
        </div>
      </div>

      <p className="pay-invite-footer-link">
        <Link to="/">{t('Back to home', 'العودة للرئيسية')}</Link>
      </p>
    </div>
  )
}

export default PayInvitePage
