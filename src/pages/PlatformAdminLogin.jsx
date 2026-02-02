import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import {
  loadPlatformAdmins,
  getPlatformAdminByCredentials,
  createPlatformOwner,
  savePlatformAdminsAsync
} from '../storage/adminStorage'
import { setPlatformAdminSession } from '../storage/platformAdminAuth'
import './PlatformAdminLogin.css'

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
  const [language, setLanguage] = useState(getAppLanguage())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

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
        navigate('/admin/all-clubs', { replace: true })
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
        const ok = await savePlatformAdminsAsync(loadPlatformAdmins())
        if (!ok) console.warn('Platform admins may not have synced to cloud')
        setPlatformAdminSession(owner)
        navigate('/admin/all-clubs', { replace: true })
      } else {
        setError(language === 'en' ? 'Could not create owner.' : 'تعذر إنشاء المالك.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={'platform-admin-login ' + (language === 'ar' ? 'rtl' : '')}>
      <header className="platform-admin-login-header">
        <Link to="/" className="platform-admin-login-back">{c.backToHome}</Link>
        <button type="button" className="platform-admin-login-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
        </button>
      </header>
      <main className="platform-admin-login-main">
        <div className="platform-admin-login-card">
          <h1>{needsSetup ? c.setupTitle : c.title}</h1>
          <p>{needsSetup ? c.setupSubtitle : c.subtitle}</p>
          <form onSubmit={needsSetup ? handleCreateOwner : handleLogin} className="platform-admin-login-form">
            {error && <p className="platform-admin-login-error">{error}</p>}
            <div className="form-group">
              <label>{c.email} *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{c.password} *</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" className="platform-admin-login-submit" disabled={loading}>
              {needsSetup ? c.createOwner : c.submit}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default PlatformAdminLogin
