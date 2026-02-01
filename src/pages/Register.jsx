import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { getCurrentPlatformUser, setCurrentPlatformUser } from '../storage/platformAuth'
import { upsertMember, getMergedMembersRaw } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './Register.css'

const Register = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const joinClubId = searchParams.get('join')
  const [language, setLanguage] = useState(getAppLanguage())
  const [formData, setFormData] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  useEffect(() => {
    const user = getCurrentPlatformUser()
    if (user) {
      if (joinClubId) navigate(`/clubs/${joinClubId}`, { replace: true })
      else navigate('/', { replace: true })
    }
  }, [joinClubId, navigate])

  const t = {
    en: {
      title: 'Register on the platform',
      subtitle: 'Create an account to join clubs, book courts, buy products and participate in tournaments.',
      googleSignIn: 'Sign in with Google',
      or: 'Or create with email',
      name: 'Full name',
      email: 'Email',
      password: 'Password',
      submit: 'Register',
      backToHome: 'Back to home',
      alreadyHave: 'Already have an account?',
      login: 'Log in',
      namePlaceholder: 'Enter your name',
      emailPlaceholder: 'Enter your email',
      passwordPlaceholder: 'Choose a password',
      googleComingSoon: 'Google sign-in will be available soon'
    },
    ar: {
      title: 'التسجيل في المنصة',
      subtitle: 'أنشئ حساباً للانضمام للنوادي وحجز الملاعب وشراء المنتجات والمشاركة في البطولات.',
      googleSignIn: 'تسجيل الدخول بحساب Google',
      or: 'أو إنشاء حساب بالإيميل',
      name: 'الاسم الكامل',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      submit: 'تسجيل',
      backToHome: 'العودة للرئيسية',
      alreadyHave: 'لديك حساب مسبقاً؟',
      login: 'تسجيل الدخول',
      namePlaceholder: 'أدخل اسمك',
      emailPlaceholder: 'أدخل بريدك الإلكتروني',
      passwordPlaceholder: 'اختر كلمة مرور',
      googleComingSoon: 'تسجيل الدخول بـ Google قريباً'
    }
  }
  const c = t[language]

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!formData.name || !formData.email || !formData.password) {
      setError(language === 'en' ? 'Please fill all fields.' : 'يرجى تعبئة جميع الحقول.')
      return
    }
    const members = getMergedMembersRaw()
    const existing = members.find(m => (m.email || '').toLowerCase() === formData.email.trim().toLowerCase())
    if (existing) {
      setError(language === 'en' ? 'This email is already registered.' : 'هذا البريد مسجّل مسبقاً.')
      return
    }
    const newMember = {
      id: Date.now().toString(),
      name: formData.name.trim(),
      email: formData.email.trim(),
      password: formData.password,
      clubIds: [],
      role: 'member',
      createdAt: new Date().toISOString()
    }
    if (!upsertMember(newMember)) {
      setError(language === 'en' ? 'Registration failed.' : 'فشل التسجيل.')
      return
    }
    setCurrentPlatformUser(newMember.id)
    if (joinClubId) navigate(`/clubs/${joinClubId}`, { replace: true })
    else navigate('/', { replace: true })
  }

  return (
    <div className="register-page">
      <header className="register-header">
        <Link to="/" className="register-back">{c.backToHome}</Link>
        <button type="button" className="register-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} title={language === 'en' ? 'العربية' : 'English'}>
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
        </button>
      </header>
      <main className="register-main">
        <div className="register-card">
          <h1 className="register-title">{c.title}</h1>
          <p className="register-subtitle">{c.subtitle}</p>
          <button
            type="button"
            className="register-google-btn"
            onClick={() => alert(c.googleComingSoon)}
          >
            <span className="register-google-icon">G</span>
            {c.googleSignIn}
          </button>
          <p className="register-or">{c.or}</p>
          <form onSubmit={handleSubmit} className="register-form">
            {error && <p className="register-error">{error}</p>}
            <div className="form-group">
              <label htmlFor="name">{c.name} *</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={c.namePlaceholder}
                required
                autoComplete="name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">{c.email} *</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={c.emailPlaceholder}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">{c.password} *</label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={c.passwordPlaceholder}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="register-submit">{c.submit}</button>
          </form>
          <p className="register-login-hint">
            {c.alreadyHave} <Link to="/login">{c.login}</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default Register
