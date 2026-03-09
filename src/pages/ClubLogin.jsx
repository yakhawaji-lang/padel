import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { getClubAdminSessionFromCredentials } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import { setClubAdminSession } from '../storage/clubAuth'
import './auth-login.css'

const ClubLogin = () => {
  const navigate = useNavigate()
  const [language, setLanguage] = useState(getAppLanguage())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => setAppLanguage(language), [language])

  const t = {
    en: {
      title: 'Club Admin Login',
      subtitle: 'Enter your email and password to access your club dashboard. You can log in even while your club registration is pending approval.',
      email: 'Email',
      password: 'Password',
      submit: 'Login',
      backToHome: 'Back to home',
      registerClub: 'Register a new club',
      notApproved: 'You can log in and explore your club dashboard while your registration is under review.'
    },
    ar: {
      title: 'تسجيل دخول النادي',
      subtitle: 'أدخل البريد الإلكتروني وكلمة المرور للدخول إلى لوحة تحكم النادي. يمكنك الدخول حتى أثناء انتظار الموافقة على تسجيل النادي.',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      submit: 'دخول',
      backToHome: 'العودة للرئيسية',
      registerClub: 'تسجيل نادٍ جديد',
      notApproved: 'يمكنك الدخول واستكشاف لوحة التحكم أثناء مراجعة التسجيل.'
    }
  }
  const c = t[language]

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const sessionInfo = getClubAdminSessionFromCredentials(email.trim(), password)
    setLoading(false)
    if (sessionInfo) {
      setClubAdminSession({
        clubId: sessionInfo.clubId,
        userId: sessionInfo.userId,
        isOwner: sessionInfo.isOwner,
        permissions: sessionInfo.permissions
      })
      navigate(`/admin/club/${sessionInfo.clubId}/dashboard`, { replace: true })
    } else {
      setError(language === 'en'
        ? 'Invalid email or password.'
        : 'البريد الإلكتروني أو كلمة المرور غير صحيحة.')
    }
  }

  return (
    <div className={'auth-login-page auth-login-club ' + (language === 'ar' ? 'rtl' : '')}>
      <header className="auth-login-header">
        <Link to="/" className="auth-login-back">{c.backToHome}</Link>
        <button type="button" className="auth-login-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
        </button>
      </header>
      <main className="auth-login-main">
        <div className="auth-login-card">
          <h1>{c.title}</h1>
          <p>{c.subtitle}</p>
          <form onSubmit={handleSubmit} className="auth-login-form">
            {error && <p className="auth-login-error">{error}</p>}
            <div className="form-group">
              <label>{c.email} *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required autoComplete="email" />
            </div>
            <div className="form-group auth-password-wrap">
              <label>{c.password} *</label>
              <div className="auth-password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <button type="submit" className="auth-login-submit" disabled={loading}>
              {loading ? (language === 'en' ? 'Please wait...' : 'جاري المعالجة...') : c.submit}
            </button>
          </form>
          <p className="auth-login-hint">
            <Link to="/forgot-password?type=club">{language === 'en' ? 'Forgot password?' : 'نسيت كلمة المرور؟'}</Link>
            {' · '}
            <Link to="/register-club">{c.registerClub}</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default ClubLogin
