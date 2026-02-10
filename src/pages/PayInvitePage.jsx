/**
 * PayInvitePage - صفحة الدفع عبر رابط الدعوة
 * /pay-invite/:token
 * تعرض بيانات المشاركة في الدفع وتوفر روابط التسجيل والدفع
 */
import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getInviteByToken } from '../api/dbClient'
import { getAppLanguage } from '../storage/languageStorage'

const PayInvitePage = () => {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const language = getAppLanguage() || 'en'

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('Token required')
      return
    }
    getInviteByToken(token)
      .then(d => setData(d))
      .catch(e => setError(e?.message || 'Failed to load invite'))
      .finally(() => setLoading(false))
  }, [token])

  const t = (en, ar) => (language === 'ar' ? ar : en)

  if (loading) {
    return (
      <div className="pay-invite-page" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <p>{t('Loading...', 'جاري التحميل...')}</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="pay-invite-page" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 }}>
        <p>{t('Invite not found or expired.', 'الرابط غير صالح أو منتهي الصلاحية.')}</p>
        <Link to="/" style={{ color: '#1e3a5f', fontWeight: 600 }}>{t('Go to home', 'العودة للرئيسية')}</Link>
      </div>
    )
  }

  const bookingDate = data.bookingDate ? new Date(data.bookingDate + 'T12:00:00').toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '-'
  const baseUrl = typeof window !== 'undefined' ? window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, '') : ''
  const registerUrl = `${baseUrl}/register?join=${encodeURIComponent(data.clubId || '')}`
  const clubsUrl = `${baseUrl}/clubs/${encodeURIComponent(data.clubId || '')}`

  return (
    <div className="pay-invite-page" style={{ maxWidth: 420, margin: '0 auto', padding: 32 }}>
      <div style={{
        background: '#f8fafc',
        borderRadius: 16,
        padding: 24,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
      }}>
        <h1 style={{ margin: '0 0 20px', fontSize: '1.25rem', color: '#1e3a5f' }}>
          {t('Payment share', 'مشاركة في الدفع')}
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: '0.9375rem', color: '#475569', lineHeight: 1.6 }}>
          {t(
            'You have been invited to share payment for a court booking.',
            'تمت دعوتك للمشاركة في دفع حجز ملعب.'
          )}
        </p>
        <dl style={{ margin: '0 0 24px', fontSize: '0.9375rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
            <dt style={{ color: '#64748b', margin: 0 }}>{t('Date', 'التاريخ')}</dt>
            <dd style={{ margin: 0, fontWeight: 600, color: '#334155' }}>{bookingDate}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
            <dt style={{ color: '#64748b', margin: 0 }}>{t('Time', 'الوقت')}</dt>
            <dd style={{ margin: 0, fontWeight: 600, color: '#334155' }}>{data.startTime || '-'} – {data.endTime || '-'}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
            <dt style={{ color: '#64748b', margin: 0 }}>{t('Your share', 'حصتك')}</dt>
            <dd style={{ margin: 0, fontWeight: 600, color: '#1e3a5f' }}>{parseFloat(data.amount || 0).toFixed(2)} SAR</dd>
          </div>
        </dl>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <a
            href={registerUrl}
            className="pay-invite-btn-primary"
            style={{
              display: 'block',
              padding: '14px 20px',
              background: '#1e3a5f',
              color: '#fff',
              textAlign: 'center',
              borderRadius: 12,
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '0.9375rem'
            }}
          >
            {t('Register to pay your share', 'سجّل وادفع حصتك')}
          </a>
          <a
            href={clubsUrl}
            style={{
              display: 'block',
              padding: '12px 20px',
              textAlign: 'center',
              color: '#64748b',
              textDecoration: 'none',
              fontSize: '0.875rem'
            }}
          >
            {t('Already registered? View club', 'مسجل مسبقاً؟ عرض النادي')}
          </a>
        </div>
      </div>

      <p style={{ marginTop: 24, textAlign: 'center' }}>
        <Link to="/" style={{ color: '#64748b', fontSize: '0.875rem' }}>{t('Back to home', 'العودة للرئيسية')}</Link>
      </p>
    </div>
  )
}

export default PayInvitePage
