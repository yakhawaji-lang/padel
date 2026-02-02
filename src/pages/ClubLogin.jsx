import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { getClubAdminSessionFromCredentials } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import { setClubAdminSession } from '../storage/clubAuth'
import './ClubLogin.css'

const ClubLogin = () => {
  const navigate = useNavigate()
  const [language, setLanguage] = useState(getAppLanguage())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => setAppLanguage(language), [language])

  const t = {
    en: {
      title: 'Club Admin Login',
      subtitle: 'Enter your email and password to access your club dashboard.',
      email: 'Email',
      password: 'Password',
      submit: 'Login',
      backToHome: 'Back to home',
      registerClub: 'Register a new club',
      notApproved: 'Your club registration is pending approval. Please wait for admin review.'
    },
    ar: {
      title: 'تسجيل دخول النادي',
      subtitle: 'أدخل البريد الإلكتروني وكلمة المرور للدخول إلى لوحة تحكم النادي.',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      submit: 'دخول',
      backToHome: 'العودة للرئيسية',
      registerClub: 'تسجيل نادٍ جديد',
      notApproved: 'تسجيل النادي قيد المراجعة. يرجى الانتظار حتى تتم الموافقة.'
    }
  }
  const c = t[language]

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const sessionInfo = getClubAdminSessionFromCredentials(email.trim(), password)
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
        ? 'Invalid credentials or club not yet approved.' 
        : 'بيانات خاطئة أو النادي لم تتم الموافقة عليه بعد.')
    }
  }

  return (
    <div className="club-login-page">
      <header className="club-login-header">
        <Link to="/" className="club-login-back">{c.backToHome}</Link>
        <button type="button" className="club-login-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
        </button>
      </header>
      <main className="club-login-main">
        <div className="club-login-card">
          <h1 className="club-login-title">{c.title}</h1>
          <p className="club-login-subtitle">{c.subtitle}</p>
          <form onSubmit={handleSubmit} className="club-login-form">
            {error && <p className="club-login-error">{error}</p>}
            <div className="form-group">
              <label>{c.email}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
            </div>
            <div className="form-group">
              <label>{c.password}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="club-login-submit">{c.submit}</button>
          </form>
          <p className="club-login-register-hint">
            <Link to="/register-club">{c.registerClub}</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default ClubLogin
