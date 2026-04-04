/**
 * PayInvitePage - صفحة المشاركة في الدفع عبر رابط الدعوة
 * /pay-invite/:token
 * المدعو يسجّل بالبريد (كود تحقق) ثم يكمل البيانات ويُوجَّه لدفع الحصة (نادي / إلكتروني)
 */
import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { getInviteByToken, recordPayment, getWalletBalance } from '../api/dbClient'
import { getAppLanguage } from '../storage/languageStorage'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { addMemberToClub } from '../storage/adminStorage'
import {
  normalizeInviteTokenParam,
  persistResumeInviteToken,
  readResumeInviteToken,
  isWellFormedInviteToken,
} from '../utils/paymentShareDeepLink'
import './PayInvitePage.css'
import { UnifiedPaymentActionGrid } from '../components/UnifiedPaymentOptions'

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

function readQueryParams(search) {
  try {
    const q = (search || '').startsWith('?') ? search.slice(1) : search
    return new URLSearchParams(q || '')
  } catch {
    return new URLSearchParams()
  }
}

function resolveInviteTokenFromBrowser(tokenParam, pathname, search) {
  const sp = readQueryParams(search)
  const chunks = [
    tokenParam,
    sp.get('token'),
    sp.get('invite'),
    sp.get('t'),
    sp.get('inv'),
    sp.get('i'),
    typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '') : '',
    typeof window !== 'undefined' ? window.location.href : '',
    `${pathname || ''} ${search || ''}`,
  ].filter((x) => x != null && String(x).trim() !== '')
  for (const c of chunks) {
    const t = normalizeInviteTokenParam(c)
    if (isWellFormedInviteToken(t)) return t
  }
  return normalizeInviteTokenParam(tokenParam)
}

const PayInvitePage = () => {
  const navigate = useNavigate()
  const { token: tokenParam } = useParams()
  const location = useLocation()
  const tokenNorm = React.useMemo(
    () => resolveInviteTokenFromBrowser(tokenParam, location.pathname, location.search),
    [tokenParam, location.pathname, location.search]
  )

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const h = (window.location.hash || '').replace(/^#\/?/, '')
    if (!h || !/pay-invite/i.test(h)) return
    const tail = h.includes('pay-invite/') ? h.split('pay-invite/')[1] : h
    const t = normalizeInviteTokenParam(tail)
    if (!isWellFormedInviteToken(t)) return
    const path = `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/pay-invite/${t}`
    navigate(`/pay-invite/${t}`, { replace: true })
    try {
      window.history.replaceState(null, '', path)
    } catch (_) {}
  }, [navigate])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorStatus, setErrorStatus] = useState(null)
  /** Flags from last fetch (JSON vs HTML 404, API codes) — avoids showing «invite missing» when /api is not proxied */
  const [errorDetail, setErrorDetail] = useState(null)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [markedPaid, setMarkedPaid] = useState(false)
  const [walletBal, setWalletBal] = useState(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const language = getAppLanguage() || 'en'

  const loadInvite = React.useCallback(async () => {
    const stored = readResumeInviteToken()
    const urlOk = isWellFormedInviteToken(tokenNorm)
    const storedOk = isWellFormedInviteToken(stored)
    const candidates = []
    if (urlOk) candidates.push(tokenNorm)
    if (storedOk && stored !== tokenNorm) candidates.push(stored)
    if (!candidates.length) {
      setLoading(false)
      setError('Token required')
      setErrorStatus(null)
      setErrorDetail(null)
      setData(null)
      return
    }
    setError(null)
    setErrorStatus(null)
    setErrorDetail(null)
    setLoading(true)
    let lastErr = null
    for (const t of candidates) {
      try {
        const d = await getInviteByToken(t)
        setData(d)
        setError(null)
        setErrorStatus(null)
        setErrorDetail(null)
        persistResumeInviteToken(d?.inviteToken || t)
        const canon = d?.inviteToken || t
        if (canon && canon !== tokenNorm) {
          navigate(`/pay-invite/${canon}`, { replace: true })
        }
        setLoading(false)
        return
      } catch (e) {
        lastErr = e
      }
    }
    setData(null)
    setError(lastErr?.message || 'Failed to load invite')
    const st = lastErr?.status ?? (lastErr?.message && /fetch|network|failed to load/i.test(lastErr.message) ? 'network' : null)
    setErrorStatus(st)
    setErrorDetail(
      lastErr
        ? {
            apiCode: lastErr.apiCode,
            receivedHtml: !!lastErr.receivedHtml,
            nonJsonBody: !!lastErr.nonJsonBody,
          }
        : null
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
        if (!c) setWalletBal(null)
      })
      .finally(() => {
        if (!c) setWalletLoading(false)
      })
    return () => {
      c = true
    }
  }, [platformUser?.id, data?.clubId, data?.paidAt])

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
    const tokenMissing =
      error === 'Token required' || (error != null && String(error).toLowerCase().includes('token required'))
    const is404 = errorStatus === 404
    const isNetwork = errorStatus === 'network' || (error && /fetch|network|failed to load/i.test(String(error)))
    const apiUnreachable =
      !!errorDetail?.receivedHtml || (is404 && !!errorDetail?.nonJsonBody)
    const inviteMissingDb =
      is404 &&
      !apiUnreachable &&
      (errorDetail?.apiCode === 'INVITE_NOT_FOUND' ||
        String(error || '')
          .toLowerCase()
          .includes('invite not found'))
    const title = tokenMissing
      ? t('Incomplete invite link', 'رابط الدعوة غير مكتمل')
      : isNetwork
        ? t('Cannot reach server', 'لا يمكن الاتصال بالسيرفر')
        : apiUnreachable
          ? t('Payment service unavailable', 'خدمة الدفع غير متاحة')
          : inviteMissingDb
            ? t('Invite not found', 'لم يتم العثور على الدعوة')
            : is404
              ? t('Invite not found', 'لم يتم العثور على الدعوة')
              : errorStatus != null && errorStatus >= 500
                ? t('Server error', 'خطأ في الخادم')
                : t('Could not load invite', 'تعذّر تحميل الدعوة')
    const message = tokenMissing
      ? t(
          'Use the full link from WhatsApp (it must include inv_ and 32 letters/numbers after it). If the line was split, copy the whole URL or ask the club to resend.',
          'استخدم الرابط كاملاً من واتساب (يجب أن يحتوي على inv_ ثم 32 حرفاً أو رقماً). إذا انقسم السطر انسخ الرابط كاملاً أو اطلب إعادة الإرسال من النادي.'
        )
      : isNetwork
        ? t('Make sure the API server is running (e.g. port 4000) and try again.', 'تأكد من تشغيل سيرفر واجهة برمجة التطبيقات (مثلاً المنفذ 4000) ثم أعد المحاولة.')
        : apiUnreachable
          ? t(
              'The app could not load invite data from the API (the server returned a web page instead of JSON). On your host, ensure requests to /api are forwarded to the Node backend. You can also set a full API URL via the playtix-api-base meta tag or window.__PLAYTIX_API_BASE__.',
              'تعذّر جلب بيانات الدعوة من واجهة البرمجة (الخادم أعاد صفحة ويب بدلاً من JSON). على الاستضافة، تأكد من توجيه المسار /api إلى سيرفر Node. يمكنك أيضاً ضبط عنوان API كامل عبر وسم meta playtix-api-base أو window.__PLAYTIX_API_BASE__.'
            )
          : inviteMissingDb
            ? t(
                'This invite is not in the database. It may have been removed, or the link was created on another server or database. Ask the club to create the share again from the live admin panel and resend the WhatsApp link.',
                'هذه الدعوة غير موجودة في قاعدة البيانات. ربما حُذفت، أو أُنشئت على سيرفر أو قاعدة بيانات أخرى. اطلب من النادي إنشاء الحصة من جديد من لوحة الإدارة المباشرة وإعادة إرسال رابط واتساب.'
              )
            : is404
              ? t(
                  'This page or invite could not be loaded. Check your link or try again later.',
                  'تعذّر تحميل هذه الصفحة أو الدعوة. تحقق من الرابط أو أعد المحاولة لاحقاً.'
                )
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

  const handlePayWallet = async () => {
    const inviteTok = data?.inviteToken || tokenNorm
    if (!inviteTok || !data?.clubId) return
    setMarkingPaid(true)
    try {
      await recordPayment({ inviteToken: inviteTok, clubId: data.clubId, paymentMethod: 'wallet' })
      setMarkedPaid(true)
    } catch (e) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(e?.message || (language === 'ar' ? 'فشل الدفع من المحفظة' : 'Wallet payment failed'))
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
                <UnifiedPaymentActionGrid
                  language={language}
                  layoutRow
                  atClubChosen={chosePayAtClub}
                  atClubTitle={chosePayAtClub ? t('Chosen — pay at club', 'اخترتها — سأدفع في النادي') : t('Pay at club', 'الدفع في النادي')}
                  atClubDesc={t('Cash or card at the club', 'كاش أو بطاقة في النادي')}
                  onPayAtClub={handleMarkPaid}
                  atClubDisabled={markingPaid}
                  atClubBusy={markingPaid}
                  electronicHref={`/pay-share/${canonicalInviteToken}`}
                  electronicTitle={t('Pay electronically', 'الدفع الإلكتروني')}
                  electronicDesc={t('Card or Mada online', 'بطاقة أو متاب أونلاين')}
                  onPayWallet={handlePayWallet}
                  walletDisabled={
                    walletLoading ||
                    (walletBal != null && walletBal + 1e-9 < (parseFloat(data?.amount) || 0))
                  }
                  walletBusy={markingPaid}
                />
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
