import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import { requestPasswordReset } from '../api/dbClient'
import './ForgotPassword.css'

const t = {
  en: {
    title: 'Forgot password?',
    subtitle: 'Enter your email and we will send you a link to reset your password.',
    email: 'Email',
    emailPlaceholder: 'Enter your email',
    submit: 'Send reset link',
    backToLogin: 'Back to login',
    backToHome: 'Back to home',
    success: 'If an account exists with this email, you will receive a password reset link.',
    error: 'Something went wrong. Please try again later.',
    sending: 'Sending...'
  },
  ar: {
    title: 'نسيت كلمة المرور؟',
    subtitle: 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لاستعادة كلمة المرور.',
    email: 'البريد الإلكتروني',
    emailPlaceholder: 'أدخل بريدك الإلكتروني',
    submit: 'إرسال رابط الاستعادة',
    backToLogin: 'العودة لتسجيل الدخول',
    backToHome: 'العودة للرئيسية',
    success: 'إذا كان هناك حساب بهذا البريد، ستتلقى رابط استعادة كلمة المرور.',
    error: 'حدث خطأ. حاول مرة أخرى لاحقاً.',
    sending: 'جاري الإرسال...'
  }
}

const ForgotPassword = () => {
  const [language, setLanguage] = useState(getAppLanguage())
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  React.useEffect(() => {
    setAppLanguage(language)
  }, [language])

  const c = t[language]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('')
    setMessage('')
    const em = email.trim()
    if (!em) return
    setLoading(true)
    try {
      await requestPasswordReset(em)
      setStatus('success')
      setMessage(c.success)
    } catch (err) {
      setStatus('error')
      setMessage(err?.message || c.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={'forgot-password-page ' + (language === 'ar' ? 'rtl' : '')}>
      <header className="forgot-password-header">
        <Link to="/" className="forgot-password-back">{c.backToHome}</Link>
        <button type="button" className="forgot-password-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} title={language === 'en' ? 'العربية' : 'English'}>
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
        </button>
      </header>
      <main className="forgot-password-main">
        <div className="forgot-password-card">
          <h1 className="forgot-password-title">{c.title}</h1>
          <p className="forgot-password-subtitle">{c.subtitle}</p>
          {status === 'success' ? (
            <div className="forgot-password-success">
              <p>{message}</p>
              <Link to="/login" className="forgot-password-btn">{c.backToLogin}</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="forgot-password-form">
              {status === 'error' && <p className="forgot-password-error">{message}</p>}
              <div className="form-group">
                <label htmlFor="email">{c.email} *</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={c.emailPlaceholder}
                  required
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="forgot-password-submit" disabled={loading}>
                {loading ? c.sending : c.submit}
              </button>
            </form>
          )}
          <p className="forgot-password-login-hint">
            <Link to="/login">{c.backToLogin}</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default ForgotPassword
