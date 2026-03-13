import React, { useState } from 'react'
import { sendClubEmailVerificationEmail, verifyClubEmail } from '../../api/dbClient'
import { refreshClubsFromApi } from '../../storage/adminStorage'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

export default function ClubEmailVerificationBanner({ club, language, onVerified }) {
  const [step, setStep] = useState('prompt') // 'prompt' | 'code' | 'verifying'
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!club || club.emailVerified) return null

  const adminEmail = (club.adminEmail || club.email || '').trim()

  const handleSendCode = async () => {
    setError('')
    if (!adminEmail || !adminEmail.includes('@')) {
      setError(language === 'ar' ? 'البريد الإداري غير محدد.' : 'Admin email not set.')
      return
    }
    setLoading(true)
    try {
      await sendClubEmailVerificationEmail(adminEmail)
      setStep('code')
      setError('')
    } catch (e) {
      setError(e?.message || (language === 'ar' ? 'فشل إرسال الكود.' : 'Failed to send code.'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setError('')
    const codeStr = (code || '').replace(/\D/g, '')
    if (codeStr.length !== 4) {
      setError(language === 'ar' ? 'أدخل الكود المكوّن من 4 أرقام.' : 'Enter the 4-digit code.')
      return
    }
    setLoading(true)
    try {
      await verifyClubEmail(adminEmail, codeStr, club.id)
      await refreshClubsFromApi()
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      onVerified?.()
    } catch (e) {
      setError(e?.message || (language === 'ar' ? 'كود غير صالح أو منتهٍ.' : 'Invalid or expired code.'))
    } finally {
      setLoading(false)
    }
  }

  const c = {
    title: t('Complete email verification', 'استكمال تفعيل البريد الإلكتروني', language),
    desc: t('Your club email is not verified. Verify it to receive important notifications.', 'بريد النادي غير مفعّل. فعّله لاستلام الإشعارات المهمة.', language),
    sendCode: t('Send verification code', 'إرسال كود التحقق', language),
    enterCode: t('Enter 4-digit code', 'أدخل الكود المكوّن من 4 أرقام', language),
    verify: t('Verify', 'تأكيد', language),
    dismiss: t('Dismiss', 'إخفاء', language),
  }

  return (
    <div className="club-email-verification-banner" style={{
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      border: '1px solid #f59e0b',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.5rem' }}>✉️</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 600 }}>{c.title}</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#92400e' }}>{c.desc}</p>
          {step === 'prompt' && (
            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: '#f59e0b',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...') : c.sendCode}
            </button>
          )}
          {step === 'code' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                disabled={loading}
                style={{
                  width: 80,
                  padding: '8px 12px',
                  textAlign: 'center',
                  letterSpacing: 6,
                  fontSize: '1.1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                }}
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: '#f59e0b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (language === 'ar' ? 'جاري التحقق...' : 'Verifying...') : c.verify}
              </button>
            </div>
          )}
          {error && <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#dc2626' }}>{error}</p>}
        </div>
      </div>
    </div>
  )
}
