import React, { useState } from 'react'
import { useAdminPanel } from '../AdminPanelContext'
import { sendSmsTestMessage } from '../../api/dbClient'
import './common.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

export default function SMSTestPage() {
  const { language = 'en' } = useAdminPanel()
  const [phone, setPhone] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setResult(null)
    if (!phone.trim() || !text.trim()) {
      setResult({ ok: false, error: language === 'ar' ? 'أدخل رقم الجوال ونص الرسالة' : 'Enter phone and message text' })
      return
    }
    setLoading(true)
    try {
      const res = await sendSmsTestMessage(phone.trim(), text.trim())
      setResult({ ok: true, messageId: res.messageId })
      setText('')
    } catch (err) {
      setResult({ ok: false, error: err?.message || (language === 'ar' ? 'فشل الإرسال' : 'Send failed') })
    } finally {
      setLoading(false)
    }
  }

  const c = {
    title: t('Send SMS test message', 'إرسال رسالة SMS تجريبية', language),
    phone: t('Phone number', 'رقم الجوال', language),
    phonePlaceholder: t('e.g. 966501234567 or 0501234567', 'مثال: 966501234567 أو 0501234567', language),
    message: t('Message text', 'نص الرسالة', language),
    send: t('Send', 'إرسال', language),
    sending: t('Sending...', 'جاري الإرسال...', language),
    success: t('Message sent successfully.', 'تم إرسال الرسالة بنجاح.', language),
    notConfigured: t('SMS is not configured. Add AUTHENTICA_API_KEY (for Saudi) or Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID) on the server.', 'SMS غير مضبوط. أضف AUTHENTICA_API_KEY (للسعودية) أو بيانات Twilio على السيرفر.', language),
    settingsTitle: t('SMS Settings (Authentica or Twilio)', 'إعدادات SMS (Authentica أو Twilio)', language),
    settingsHint: t('Add these Environment Variables on Hostinger (hPanel → Node.js → Environment Variables):', 'أضف هذه المتغيرات في Hostinger (hPanel → Node.js → Environment Variables):', language),
    authenticaTitle: t('Authentica (Saudi Arabia — preferred)', 'Authentica (السعودية — مفضّل)', language),
  }

  return (
    <div className="main-admin-page" style={{ padding: 24, maxWidth: 640 }}>
      <h1 className="main-admin-page-title" style={{ marginBottom: 16 }}>{c.title}</h1>

      {/* Twilio SMS Settings Section */}
      <div style={{ marginBottom: 24, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: '#f8fafc',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontWeight: 600,
            fontSize: '0.95rem',
          }}
        >
          {c.settingsTitle}
          <span style={{ fontSize: '1.2rem' }}>{showSettings ? '−' : '+'}</span>
        </button>
        {showSettings && (
          <div style={{ padding: 20, background: '#fff', borderTop: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
            <p style={{ color: '#64748b', marginBottom: 16 }}>{c.settingsHint}</p>
            <p style={{ fontWeight: 600, marginBottom: 8, color: '#059669' }}>{c.authenticaTitle}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: '#64748b' }}>{language === 'ar' ? 'المتغير' : 'Variable'}</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: '#64748b' }}>{language === 'ar' ? 'الوصف' : 'Description'}</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>AUTHENTICA_API_KEY</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'من portal.authentica.sa' : 'From portal.authentica.sa'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>AUTHENTICA_SENDER_NAME</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'اسم المرسل المسجّل (افتراضي: PlayTix)' : 'Registered sender name (default: PlayTix)'}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontWeight: 600, marginBottom: 8, marginTop: 16 }}>{language === 'ar' ? 'Twilio' : 'Twilio'}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: '#64748b' }}>{language === 'ar' ? 'المتغير' : 'Variable'}</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: '#64748b' }}>{language === 'ar' ? 'الوصف' : 'Description'}</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>TWILIO_ACCOUNT_SID</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'من Twilio Console' : 'From Twilio Console'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>TWILIO_AUTH_TOKEN</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'من Twilio Console' : 'From Twilio Console'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>TWILIO_MESSAGING_SERVICE_SID</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'من Messaging → Services (SID يبدأ بـ MG)' : 'From Messaging → Services (SID starts with MG)'}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginBottom: 8, fontSize: '0.8rem', color: '#64748b' }}>
              {language === 'ar' ? 'احصل على القيم من:' : 'Get values from:'} <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0f172a' }}>console.twilio.com</a>
            </p>
          </div>
        )}
      </div>

      <p style={{ color: '#64748b', marginBottom: 12, fontSize: '0.9rem' }}>
        {language === 'ar'
          ? 'أدخل رقم الجوال (بدون + أو مسافات) ونص الرسالة. استخدم رمز الدولة مع الرقم (مثل 966501234567 للسعودية).'
          : 'Enter phone number (without + or spaces) and message. Include country code (e.g. 966501234567 for Saudi).'}
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label htmlFor="sms-phone" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.phone}</label>
          <input
            id="sms-phone"
            type="text"
            inputMode="numeric"
            dir="ltr"
            className="western-numerals"
            placeholder={c.phonePlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8 }}
            disabled={loading}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label htmlFor="sms-text" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.message}</label>
          <textarea
            id="sms-text"
            rows={4}
            placeholder={language === 'ar' ? 'اكتب الرسالة هنا...' : 'Type your message here...'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, resize: 'vertical' }}
            disabled={loading}
          />
        </div>
        {result && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              backgroundColor: result.ok ? '#ecfdf5' : '#fef2f2',
              color: result.ok ? '#059669' : '#dc2626',
            }}
          >
            {result.ok ? c.success : (result.error || c.notConfigured)}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: loading ? '#94a3b8' : '#0f172a',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? c.sending : c.send}
        </button>
      </form>
    </div>
  )
}
