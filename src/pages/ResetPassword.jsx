import React, { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import { confirmPasswordReset } from '../api/dbClient'
import backendStorage from '../storage/backendStorage'
import './ForgotPassword.css'

const t = {
  en: {
    title: 'Set new password',
    subtitle: 'Enter your new password below.',
    password: 'New password',
    passwordPlaceholder: 'Min. 6 characters',
    submit: 'Reset password',
    backToLogin: 'Back to login',
    backToHome: 'Back to home',
    success: 'Password updated. You can now log in.',
    error: 'Invalid or expired link. Request a new one.',
    genericError: 'Something went wrong. Please try again.'
  },
  ar: {
    title: 'تعيين كلمة مرور جديدة',
    subtitle: 'أدخل كلمة المرور الجديدة أدناه.',
    password: 'كلمة المرور الجديدة',
    passwordPlaceholder: '6 أحرف على الأقل',
    submit: 'استعادة كلمة المرور',
    backToLogin: 'العودة لتسجيل الدخول',
    backToHome: 'العودة للرئيسية',
    success: 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.',
    error: 'رابط غير صالح أو منتهي. اطلب رابطاً جديداً.',
    genericError: 'حدث خطأ. حاول مرة أخرى.'
  }
}

const ResetPassword = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const resetType = searchParams.get('type')
  const [language, setLanguage] = useState(getAppLanguage())
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage(t[language].error)
    }
  }, [token, language])

  const c = t[language]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('')
    setMessage('')
    if (!token) return
    if (password.length < 6) {
      setStatus('error')
      setMessage(language === 'en' ? 'Password must be at least 6 characters.' : 'كلمة المرور 6 أحرف على الأقل.')
      return
    }
    if (password !== confirmPassword) {
      setStatus('error')
      setMessage(language === 'en' ? 'Passwords do not match.' : 'كلمتا المرور غير متطابقتين.')
      return
    }
    setLoading(true)
    try {
      await confirmPasswordReset(token, password)
      if (backendStorage.refreshStoreKeys) {
        const keys = ['all_members', 'padel_members']
        if (resetType === 'platform') keys.push('platform_admins')
        if (resetType === 'club') keys.push('admin_clubs')
        await backendStorage.refreshStoreKeys(keys).catch(() => {})
      }
      setStatus('success')
      setMessage(c.success)
      const loginPath = resetType === 'platform' ? '/super-admin' : resetType === 'club' ? '/club-login' : '/login'
      setTimeout(() => navigate(loginPath), 2500)
    } catch (err) {
      setStatus('error')
      setMessage(err?.message || c.genericError)
    } finally {
      setLoading(false)
    }
  }

  if (!token && status !== 'error') {
    return null
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
              <Link to={resetType === 'platform' ? '/super-admin' : resetType === 'club' ? '/club-login' : '/login'} className="forgot-password-btn">{c.backToLogin}</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="forgot-password-form">
              {status === 'error' && <p className="forgot-password-error">{message}</p>}
              <div className="form-group">
                <label htmlFor="password">{c.password} *</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={c.passwordPlaceholder}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirm">{language === 'en' ? 'Confirm password' : 'تأكيد كلمة المرور'} *</label>
                <input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={c.passwordPlaceholder}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="forgot-password-submit" disabled={loading}>
                {loading ? (language === 'en' ? 'Updating...' : 'جاري التحديث...') : c.submit}
              </button>
            </form>
          )}
          <p className="forgot-password-login-hint">
            <Link to={resetType === 'platform' ? '/super-admin' : resetType === 'club' ? '/club-login' : '/login'}>{c.backToLogin}</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default ResetPassword
