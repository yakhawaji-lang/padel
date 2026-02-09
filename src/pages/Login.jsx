import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './Login.css'
import { getMergedMembersRaw } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import { setCurrentPlatformUser } from '../storage/platformAuth'

/** Normalize for comparison: trim, lowercase emails, digits-only for phones */
function norm(s) {
  if (s == null) return ''
  const t = String(s).trim()
  if (t.includes('@')) return t.toLowerCase()
  const digits = t.replace(/\D/g, '')
  if (digits.length >= 8) return digits.replace(/^966/, '').replace(/^0/, '') || digits
  return t
}

const Login = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const joinClubId = searchParams.get('join')
  const returnUrl = searchParams.get('return')
  const [language, setLanguage] = useState(getAppLanguage())
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  React.useEffect(() => {
    setAppLanguage(language)
  }, [language])

  const handleMemberLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const input = norm(formData.email)
      const password = (formData.password || '').trim()
      if (!input || !password) {
        setError(language === 'ar' ? 'أدخل البريد أو الاسم وكلمة المرور' : 'Enter email or name and password')
        return
      }
      try {
        const backend = (await import('../storage/backendStorage')).default
        if (backend?.refreshStoreKeys) {
          await backend.refreshStoreKeys(['all_members', 'padel_members'])
        }
      } catch (_) {}
      const members = getMergedMembersRaw()
      const member = members.find(m => {
        const matchId = norm(m.email) === input || norm(m.name) === input || norm(m.mobile || m.phone || '') === input
        return matchId && (m.password || '') === password
      })
      if (member) {
        await setCurrentPlatformUser(member.id)
        if (returnUrl && returnUrl.startsWith('/')) {
          navigate(returnUrl)
        } else if (joinClubId) {
          navigate(`/clubs/${joinClubId}`)
        } else {
          const clubId = member.clubIds?.[0] || member.clubId
          if (clubId) navigate(`/club/${clubId}`)
          else navigate('/')
        }
      } else {
        setError(language === 'ar' ? 'البريد أو كلمة المرور غير صحيحة' : 'Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`login-page ${language === 'ar' ? 'rtl' : ''}`}>
      <div className="login-container">
        <div className="login-header">
          <Link to="/" className="login-logo-link">
            <img src="/logo-playtix.png" alt="PlayTix" className="login-logo" />
          </Link>
          <Link to="/" className="login-back-link">{language === 'en' ? 'Back to home' : 'العودة للرئيسية'}</Link>
          <div className="login-lang-wrap">
            <button
              type="button"
              className="login-lang-btn"
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              title={language === 'en' ? 'العربية' : 'English'}
            >
              <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
            </button>
          </div>
          <h1>{language === 'en' ? 'PlayTix Member Login' : 'تسجيل دخول أعضاء PlayTix'}</h1>
          <p>{joinClubId
            ? (language === 'en' ? 'Sign in to join the club' : 'سجّل الدخول للانضمام للنادي')
            : (language === 'en' ? 'Sign in to browse clubs, book courts and make purchases' : 'سجّل الدخول لتصفح النوادي وحجز الملاعب وإجراء المشتريات')}</p>
        </div>

        <div className="login-form-container">
          <form onSubmit={handleMemberLogin} className="login-form">
            {error && <p className="login-error" role="alert">{error}</p>}
            <div className="form-group">
              <label>{language === 'en' ? 'Email or name' : 'البريد أو الاسم'}</label>
              <input
                type="text"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={language === 'en' ? 'Enter email or name' : 'أدخل البريد أو الاسم'}
                required
              />
            </div>
            <div className="form-group">
              <label>{language === 'en' ? 'Password' : 'كلمة المرور'}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={language === 'en' ? 'Enter password' : 'أدخل كلمة المرور'}
                required
              />
            </div>
            <button type="submit" className="btn-primary btn-block" disabled={loading}>
              {loading ? (language === 'en' ? 'Logging in...' : 'جاري تسجيل الدخول...') : (language === 'en' ? 'Login' : 'تسجيل الدخول')}
            </button>
          </form>
          <p className="login-forgot-hint">
            <Link to="/forgot-password?type=member">
              {language === 'en' ? 'Forgot password?' : 'نسيت كلمة المرور؟'}
            </Link>
          </p>
          <p className="login-register-hint">
            {language === 'en' ? "Don't have an account? " : 'ليس لديك حساب؟ '}
            <Link to={joinClubId ? `/register?join=${joinClubId}` : '/register'}>
              {language === 'en' ? 'Register' : 'تسجيل'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
