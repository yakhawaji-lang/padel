import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import {
  loadPlatformAdmins,
  getPlatformAdminByCredentials,
  createPlatformOwner,
  savePlatformAdminsAsync
} from '../storage/adminStorage'
import { setPlatformAdminSession } from '../storage/platformAdminAuth'
import './auth-login.css'

const t = {
  en: {
    title: 'Platform Admin Login',
    subtitle: 'Sign in to manage all clubs and platform settings.',
    setupTitle: 'Create Platform Owner',
    setupSubtitle: 'No platform owner exists. Create the first one to get started.',
    email: 'Email',
    password: 'Password',
    submit: 'Login',
    createOwner: 'Create owner',
    backToHome: 'Back to home',
    error: 'Invalid credentials.'
  },
  ar: {
    title: 'تسجيل دخول إدارة المنصة',
    subtitle: 'سجّل الدخول لإدارة جميع الأندية وإعدادات المنصة.',
    setupTitle: 'إنشاء مالك المنصة',
    setupSubtitle: 'لا يوجد مالك للمنصة. أنشئ الأول للبدء.',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    submit: 'دخول',
    createOwner: 'إنشاء المالك',
    backToHome: 'العودة للرئيسية',
    error: 'بيانات خاطئة.'
  }
}

const PlatformAdminLogin = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [language, setLanguage] = useState(getAppLanguage())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  useEffect(() => {
    const admins = loadPlatformAdmins()
    setNeedsSetup(admins.length === 0)
  }, [])

  const c = t[language]

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const admin = getPlatformAdminByCredentials(email.trim(), password)
      if (admin) {
        setPlatformAdminSession(admin)
        const from = location.state?.from?.pathname
        navigate(from && from.startsWith('/admin') ? from : '/admin/all-clubs', { replace: true, state: {} })
      } else {
        setError(c.error)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOwner = async (e) => {
    e.preventDefault()
    setError('')
    if (!password || password.length < 6) {
      setError(language === 'en' ? 'Password must be at least 6 characters.' : 'كلمة المرور 6 أحرف على الأقل.')
      return
    }
    setLoading(true)
    try {
      const owner = createPlatformOwner(email.trim(), password)
      if (owner) {
        await savePlatformAdminsAsync(loadPlatformAdmins())
        setPlatformAdminSession(owner)
        navigate('/admin/all-clubs', { replace: true, state: {} })
      } else {
        setError(language === 'en' ? 'Owner already exists. Try logging in.' : 'المالك موجود. جرّب تسجيل الدخول.')
      }
    } finally {
      setLoading(false)
    }
  }

  const isSetup = needsSetup === true
  const isLoading = needsSetup === null

  return (
    <div className={'auth-login-page auth-login-platform ' + (language === 'ar' ? 'rtl' : '')}>
      <header className="auth-login-header">
        <Link to="/" className="auth-login-back">{c.backToHome}</Link>
        <button type="button" className="auth-login-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
        </button>
      </header>
      <main className="auth-login-main">
        <div className="auth-login-card">
          {isLoading ? (
            <div className="auth-login-loading">
              <div className="auth-login-spinner" />
              <p>{language === 'en' ? 'Loading...' : 'جاري التحميل...'}</p>
            </div>
          ) : (
            <>
              <h1>{isSetup ? c.setupTitle : c.title}</h1>
              <p>{isSetup ? c.setupSubtitle : c.subtitle}</p>
              <form onSubmit={isSetup ? handleCreateOwner : handleLogin} className="auth-login-form">
                {error && <p className="auth-login-error">{error}</p>}
                <div className="form-group">
                  <label>{c.email} *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="form-group auth-password-wrap">
                  <label>{c.password} *</label>
                  <div className="auth-password-input">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete={isSetup ? 'new-password' : 'current-password'}
                    />
                    <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Hide' : 'Show'}>
                      {showPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
                <button type="submit" className="auth-login-submit" disabled={loading}>
                  {loading ? (language === 'en' ? 'Please wait...' : 'جاري المعالجة...') : (isSetup ? c.createOwner : c.submit)}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default PlatformAdminLogin
