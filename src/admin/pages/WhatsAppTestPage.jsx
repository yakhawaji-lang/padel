import React, { useState } from 'react'
import { useAdminPanel } from '../AdminPanelContext'
import { sendWhatsAppTestMessage } from '../../api/dbClient'
import './common.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

export default function WhatsAppTestPage() {
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
      const res = await sendWhatsAppTestMessage(phone.trim(), text.trim())
      setResult({ ok: true, messageId: res.messageId })
      setText('')
    } catch (err) {
      setResult({ ok: false, error: err?.message || (language === 'ar' ? 'فشل الإرسال' : 'Send failed') })
    } finally {
      setLoading(false)
    }
  }

  const c = {
    title: t('Send WhatsApp test message', 'إرسال رسالة واتساب تجريبية', language),
    phone: t('Phone number', 'رقم الجوال', language),
    phonePlaceholder: t('e.g. 966501234567 or 0501234567', 'مثال: 966501234567 أو 0501234567', language),
    message: t('Message text', 'نص الرسالة', language),
    send: t('Send', 'إرسال', language),
    sending: t('Sending...', 'جاري الإرسال...', language),
    success: t('Message sent successfully.', 'تم إرسال الرسالة بنجاح.', language),
    notConfigured: t('WhatsApp is not configured. Add Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM) or Meta credentials on the server.', 'واتساب غير مضبوط. أضف Twilio أو بيانات Meta على السيرفر.', language),
    settingsTitle: t('Twilio Settings & Connection', 'إعدادات Twilio والربط', language),
    settingsHint: t('Add these Environment Variables on Hostinger (hPanel → Node.js → Environment Variables):', 'أضف هذه المتغيرات في Hostinger (hPanel → Node.js → Environment Variables):', language),
    webhookLabel: t('Webhook URL (for Meta / Twilio inbound):', 'رابط Webhook (للاستقبال):', language),
    verifyLabel: t('Verify Token (for Meta webhook):', 'رمز التحقق (لـ Meta):', language),
  }

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp-webhook` : 'https://playtix.app/api/whatsapp-webhook'

  return (
    <div className="main-admin-page" style={{ padding: 24, maxWidth: 640 }}>
      <h1 className="main-admin-page-title" style={{ marginBottom: 16 }}>{c.title}</h1>

      {/* Twilio Settings Section */}
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
            <p style={{ marginBottom: 12, fontSize: '0.85rem' }}>{language === 'ar' ? 'للإعداد الكامل مع الرقم +15755776222:' : 'For complete setup with +15755776222:'} <a href="https://github.com/yakhawaji-lang/padel/blob/main/docs/TWILIO_SETUP_COMPLETE.md" target="_blank" rel="noopener noreferrer" style={{ color: '#0f172a' }}>TWILIO_SETUP_COMPLETE.md</a></p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: '#64748b' }}>{language === 'ar' ? 'المتغير' : 'Variable'}</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: '#64748b' }}>{language === 'ar' ? 'مثال / القيمة' : 'Example / Value'}</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: '#64748b' }}>{language === 'ar' ? 'الوصف' : 'Description'}</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>TWILIO_ACCOUNT_SID</td>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: '0.8rem' }}>ACxxxxxxxx</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'من Twilio Console → Account Info' : 'From Twilio Console → Account Info'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>TWILIO_AUTH_TOKEN</td>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: '0.8rem' }}>your_auth_token</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'من Twilio Console → Auth Token' : 'From Twilio Console → Auth Token'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>TWILIO_WHATSAPP_FROM</td>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: '0.8rem' }}>whatsapp:+14155238886</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'Sandbox للتجربة' : 'Sandbox for testing'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>TWILIO_WHATSAPP_FROM</td>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: '0.8rem' }}>whatsapp:+15755776222</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'رقمك (بعد تفعيل WhatsApp)' : 'Your number (after WhatsApp enabled)'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>WHATSAPP_SENDER_NAME</td>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: '0.8rem' }}>PlayTix</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'اسم المرسل (يُضاف تلقائياً في نهاية الرسالة)' : 'Sender name (appended to messages)'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>WHATSAPP_VERIFY_TOKEN</td>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontSize: '0.8rem' }}>playtix_whatsapp_verify</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'لـ Meta Webhook (اختياري)' : 'For Meta Webhook (optional)'}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginBottom: 8, fontSize: '0.8rem', color: '#64748b' }}>
              {language === 'ar' ? 'احصل على القيم من:' : 'Get values from:'} <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0f172a' }}>console.twilio.com</a>
            </p>
            <div style={{ marginBottom: 12 }}>
              <strong style={{ display: 'block', marginBottom: 6 }}>{c.webhookLabel}</strong>
              <code style={{ display: 'block', padding: 10, background: '#f1f5f9', borderRadius: 8, fontSize: '0.85rem', wordBreak: 'break-all' }}>{webhookUrl}</code>
            </div>
            <div>
              <strong style={{ display: 'block', marginBottom: 6 }}>{c.verifyLabel}</strong>
              <code style={{ display: 'block', padding: 10, background: '#f1f5f9', borderRadius: 8, fontSize: '0.85rem' }}>playtix_whatsapp_verify</code>
            </div>
          </div>
        )}
      </div>

      <p style={{ color: '#64748b', marginBottom: 12, fontSize: '0.9rem' }}>
        {language === 'ar'
          ? 'أدخل رقم الجوال (بدون + أو مسافات) ونص الرسالة. الرقم يجب أن يكون مسجلاً على واتساب.'
          : 'Enter phone number (without + or spaces) and message. The number must be registered on WhatsApp.'}
      </p>
      <div style={{ marginBottom: 24, padding: 12, background: '#fef3c7', borderRadius: 8, fontSize: '0.85rem', color: '#92400e' }}>
        {language === 'ar' ? (
          <>• <strong>Twilio Sandbox:</strong> المستلم يجب أن يرسل "join direction-give" إلى +14155238886 أولاً.<br />
          • استخدم رمز الدولة مع الرقم (مثل 966501234567 للسعودية).<br />
          • <strong>رقمك:</strong> استخدم TWILIO_WHATSAPP_FROM=whatsapp:+15755776222 بعد تفعيل WhatsApp على الرقم.<br />
          • الرسالة النصية الحرة تُقبل فقط خلال <strong>24 ساعة</strong> من آخر رسالة أرسلها المستلم؛ وإلا استخدم قالب معتمد.</>
        ) : (
          <>• <strong>Twilio Sandbox:</strong> Recipient must send "join direction-give" to +14155238886 first.<br />
          • <strong>Your number:</strong> Use TWILIO_WHATSAPP_FROM=whatsapp:+15755776222 after enabling WhatsApp on it.<br />
          • Include country code (e.g. 966501234567 for Saudi).<br />
          • Free-form text works only within <strong>24 hours</strong> of the recipient’s last message; otherwise use an approved template.</>
        )}
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label htmlFor="wa-phone" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.phone}</label>
          <input
            id="wa-phone"
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
          <label htmlFor="wa-text" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.message}</label>
          <textarea
            id="wa-text"
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
