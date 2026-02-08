import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './Login.css'
import { getMergedMembersRaw } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import { setCurrentPlatformUser } from '../storage/platformAuth'

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

  React.useEffect(() => {
    setAppLanguage(language)
  }, [language])

  const handleMemberLogin = (e) => {
    e.preventDefault()
    const members = getMergedMembersRaw()
    const member = members.find(m =>
      (m.email === formData.email || m.name === formData.email) &&
      m.password === formData.password
    )
    
    if (member) {
      setCurrentPlatformUser(member.id)
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
      alert('Invalid credentials')
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
            <button type="submit" className="btn-primary btn-block">
              {language === 'en' ? 'Login' : 'تسجيل الدخول'}
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
