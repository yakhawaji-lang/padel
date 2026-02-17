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
    notConfigured: t('WhatsApp is not configured on the server (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID).', 'واتساب غير مضبوط على السيرفر (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID).', language),
  }

  return (
    <div className="main-admin-page" style={{ padding: 24, maxWidth: 480 }}>
      <h1 className="main-admin-page-title" style={{ marginBottom: 16 }}>{c.title}</h1>
      <p style={{ color: '#64748b', marginBottom: 12, fontSize: '0.9rem' }}>
        {language === 'ar'
          ? 'أدخل رقم الجوال (بدون + أو مسافات) ونص الرسالة. الرقم يجب أن يكون مسجلاً على واتساب.'
          : 'Enter phone number (without + or spaces) and message. The number must be registered on WhatsApp.'}
      </p>
      <div style={{ marginBottom: 24, padding: 12, background: '#fef3c7', borderRadius: 8, fontSize: '0.85rem', color: '#92400e' }}>
        {language === 'ar' ? (
          <>• في <strong>وضع الاختبار</strong> يمكن الإرسال فقط إلى أرقام أضفتها كمتلقين اختبار في Meta (WhatsApp → API Setup).<br />
          • استخدم رمز الدولة مع الرقم (مثل 966501234567 للسعودية).<br />
          • الرسالة النصية الحرة تُقبل فقط خلال <strong>24 ساعة</strong> من آخر رسالة أرسلها المستلم إلى رقم واتساب الأعمال؛ وإلا استخدم قالب رسالة معتمد.</>
        ) : (
          <>• In <strong>test mode</strong> you can only send to phone numbers you added as test recipients in Meta (WhatsApp → API Setup).<br />
          • Include country code (e.g. 966501234567 for Saudi).<br />
          • Free-form text is only delivered within <strong>24 hours</strong> of the recipient’s last message to your business number; otherwise use an approved message template.</>
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
