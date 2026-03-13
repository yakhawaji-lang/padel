import React, { useState } from 'react'
import { useAdminPanel } from '../AdminPanelContext'
import { sendEmailTest } from '../../api/dbClient'
import './common.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

export default function EmailTestPage() {
  const { language = 'en' } = useAdminPanel()
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setResult(null)
    if (!to.trim() || !to.includes('@')) {
      setResult({ ok: false, error: language === 'ar' ? 'أدخل بريداً إلكترونياً صحيحاً' : 'Enter a valid email address' })
      return
    }
    setLoading(true)
    try {
      await sendEmailTest(to.trim(), subject.trim() || undefined, body.trim() || undefined)
      setResult({ ok: true })
      setTo('')
      setSubject('')
      setBody('')
    } catch (err) {
      setResult({ ok: false, error: err?.message || (language === 'ar' ? 'فشل الإرسال' : 'Send failed') })
    } finally {
      setLoading(false)
    }
  }

  const c = {
    title: t('Send email test', 'إرسال بريد تجريبي', language),
    to: t('Recipient email', 'البريد المستلم', language),
    toPlaceholder: t('e.g. test@example.com', 'مثال: test@example.com', language),
    subject: t('Subject', 'الموضوع', language),
    subjectPlaceholder: t('PlayTix Email Test', 'تجربة بريد PlayTix', language),
    body: t('Message body (HTML)', 'نص الرسالة (HTML)', language),
    send: t('Send', 'إرسال', language),
    sending: t('Sending...', 'جاري الإرسال...', language),
    success: t('Email sent successfully.', 'تم إرسال البريد بنجاح.', language),
    notConfigured: t('Email is not configured. Add RESEND_API_KEY or SENDGRID_API_KEY (Twilio SendGrid) in Environment Variables.', 'البريد غير مضبوط. أضف RESEND_API_KEY أو SENDGRID_API_KEY (Twilio SendGrid) في متغيرات البيئة.', language),
    settingsTitle: t('Email settings (Resend or Twilio SendGrid)', 'إعدادات البريد (Resend أو Twilio SendGrid)', language),
    settingsHint: t('Add these Environment Variables on Hostinger (hPanel → Node.js → Environment Variables):', 'أضف هذه المتغيرات في Hostinger (hPanel → Node.js → Environment Variables):', language),
    resendTitle: t('Resend', 'Resend', language),
    sendgridTitle: t('Twilio SendGrid', 'Twilio SendGrid', language),
  }

  return (
    <div className="main-admin-page" style={{ padding: 24, maxWidth: 640 }}>
      <h1 className="main-admin-page-title" style={{ marginBottom: 16 }}>{c.title}</h1>

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
            <p style={{ fontWeight: 600, marginBottom: 8, color: '#059669' }}>{c.resendTitle}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 16 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>RESEND_API_KEY</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'من resend.com' : 'From resend.com'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>RESEND_FROM</td>
                  <td style={{ padding: 8, color: '#64748b' }}>PlayTix &lt;noreply@playtix.app&gt;</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontWeight: 600, marginBottom: 8, marginTop: 16 }}>{c.sendgridTitle}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 16 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px 8px 0', fontFamily: 'monospace' }}>SENDGRID_API_KEY</td>
                  <td style={{ padding: 8, color: '#64748b' }}>{language === 'ar' ? 'من sendgrid.com (Twilio)' : 'From sendgrid.com (Twilio)'}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginBottom: 8, fontSize: '0.8rem', color: '#64748b' }}>
              {language === 'ar' ? 'راجع docs/EMAIL_SETUP.md للتفاصيل' : 'See docs/EMAIL_SETUP.md for details'}
            </p>
          </div>
        )}
      </div>

      <p style={{ color: '#64748b', marginBottom: 12, fontSize: '0.9rem' }}>
        {language === 'ar'
          ? 'أدخل البريد المستلم والموضوع والنص. يمكنك استخدام HTML في نص الرسالة.'
          : 'Enter recipient email, subject, and body. You can use HTML in the message body.'}
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label htmlFor="email-to" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.to}</label>
          <input
            id="email-to"
            type="email"
            placeholder={c.toPlaceholder}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8 }}
            disabled={loading}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label htmlFor="email-subject" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.subject}</label>
          <input
            id="email-subject"
            type="text"
            placeholder={c.subjectPlaceholder}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8 }}
            disabled={loading}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label htmlFor="email-body" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>{c.body}</label>
          <textarea
            id="email-body"
            rows={6}
            placeholder={language === 'ar' ? '<p>اكتب الرسالة هنا...</p>' : '<p>Type your message here...</p>'}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem' }}
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
