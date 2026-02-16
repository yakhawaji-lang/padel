import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'

/** Format phone from URL (digits only) to display format e.g. 966512345678 → 0512345678 */
function formatPhoneFromUrl(s) {
  if (!s || typeof s !== 'string') return ''
  const digits = s.replace(/\D/g, '')
  if (digits.startsWith('9665') && digits.length === 12) return '0' + digits.slice(3)
  if (digits.startsWith('966') && digits.length >= 10) return '0' + digits.slice(3)
  if (digits.length >= 9) return digits.startsWith('5') ? '0' + digits : digits
  return digits ? digits : s
}
import { getCurrentPlatformUser, setCurrentPlatformUser } from '../storage/platformAuth'
import { upsertMember, getMergedMembersRaw, addMemberToClub } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './Register.css'

/** Normalize phone to digits for comparison */
function phoneDigits(s) {
  return (s || '').replace(/\D/g, '')
}

const Register = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const joinClubId = searchParams.get('join')
  const phoneFromUrl = searchParams.get('phone')
  const returnTo = searchParams.get('returnTo') || ''
  const isPhoneOnlyFlow = !!(joinClubId && phoneFromUrl && phoneDigits(phoneFromUrl).length >= 8)
  const [language, setLanguage] = useState(getAppLanguage())
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: formatPhoneFromUrl(phoneFromUrl || ''),
    password: ''
  })
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  useEffect(() => {
    const user = getCurrentPlatformUser()
    if (user) {
      if (returnTo && returnTo.startsWith('/')) {
        navigate(returnTo, { replace: true })
        return
      }
      if (joinClubId) navigate(`/clubs/${joinClubId}`, { replace: true })
      else navigate('/', { replace: true })
    }
  }, [joinClubId, returnTo, navigate])

  const t = {
    en: {
      title: isPhoneOnlyFlow ? 'Quick register — payment share' : 'Register on PlayTix',
      subtitle: isPhoneOnlyFlow
        ? 'Register with your phone number to participate in the booking. Temporary password = your phone number.'
        : joinClubId
          ? 'Create an account to join the club.'
          : 'Create an account to browse clubs, book courts, buy products and participate in tournaments.',
      or: 'Create with email',
      name: 'Full name',
      email: 'Email',
      phone: 'Mobile number',
      password: 'Password',
      tempPasswordHint: 'Temporary password = your phone number (you can change it later)',
      submit: 'Register',
      backToHome: 'Back to home',
      alreadyHave: 'Already have an account?',
      login: 'Log in',
      namePlaceholder: 'Enter your name',
      emailPlaceholder: 'Enter your email',
      phonePlaceholder: 'e.g. 05xxxxxxxx',
      passwordPlaceholder: 'Choose a password',
      agreeTerms: 'I agree to the',
      privacyPolicy: 'Privacy Policy',
      and: 'and',
      termsOfService: 'Terms of Service',
      phoneAlreadyRegistered: 'This phone number is already registered. Please log in.'
    },
    ar: {
      title: isPhoneOnlyFlow ? 'تسجيل سريع — مشاركة بالدفع' : 'التسجيل في PlayTix',
      subtitle: isPhoneOnlyFlow
        ? 'سجّل برقم جوالك للمشاركة في الحجز. كلمة المرور المؤقتة = رقم جوالك.'
        : joinClubId
          ? 'أنشئ حساباً للانضمام للنادي.'
          : 'أنشئ حساباً لتصفح النوادي وحجز الملاعب وشراء المنتجات والمشاركة في البطولات.',
      or: 'إنشاء حساب بالإيميل',
      name: 'الاسم الكامل',
      email: 'البريد الإلكتروني',
      phone: 'رقم الجوال',
      password: 'كلمة المرور',
      tempPasswordHint: 'كلمة المرور المؤقتة = رقم جوالك (يمكنك تغييرها لاحقاً)',
      submit: 'تسجيل',
      backToHome: 'العودة للرئيسية',
      alreadyHave: 'لديك حساب مسبقاً؟',
      login: 'تسجيل الدخول',
      namePlaceholder: 'أدخل اسمك',
      emailPlaceholder: 'أدخل بريدك الإلكتروني',
      phonePlaceholder: 'مثال: 05xxxxxxxx',
      passwordPlaceholder: 'اختر كلمة مرور',
      agreeTerms: 'أوافق على',
      privacyPolicy: 'سياسة الخصوصية',
      and: 'و',
      termsOfService: 'شروط الخدمة',
      phoneAlreadyRegistered: 'رقم الجوال مسجّل مسبقاً. يرجى تسجيل الدخول.'
    }
  }
  const c = t[language]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!agreeToTerms) {
      setError(language === 'en' ? 'You must agree to the Privacy Policy and Terms of Service.' : 'يجب الموافقة على سياسة الخصوصية وشروط الخدمة.')
      return
    }
    const members = getMergedMembersRaw()
    const phoneOnly = isPhoneOnlyFlow && formData.phone && phoneDigits(formData.phone).length >= 8
    const effectivePassword = phoneOnly ? (formData.phone?.trim() || phoneDigits(formData.phone)) : formData.password
    if (!phoneOnly && (!formData.name || !formData.email || !formData.password)) {
      setError(language === 'en' ? 'Please fill all required fields.' : 'يرجى تعبئة جميع الحقول المطلوبة.')
      return
    }
    if (phoneOnly && !formData.phone?.trim()) {
      setError(language === 'en' ? 'Phone number is required.' : 'رقم الجوال مطلوب.')
      return
    }
    const existingByEmail = !phoneOnly && members.find(m => (m.email || '').toLowerCase() === formData.email.trim().toLowerCase())
    const existingByPhone = members.find(m => phoneDigits(m.phone || m.mobile || '') === phoneDigits(formData.phone || ''))
    if (existingByEmail) {
      setError(language === 'en' ? 'This email is already registered.' : 'هذا البريد مسجّل مسبقاً.')
      return
    }
    if (existingByPhone) {
      setError(c.phoneAlreadyRegistered)
      return
    }
    const name = (formData.name || '').trim() || (language === 'ar' ? 'مشارك' : 'Participant')
    const email = (formData.email || '').trim() || (phoneOnly ? `p${phoneDigits(formData.phone)}@pay-invite.playtix` : '')
    const newMember = {
      id: Date.now().toString(),
      name,
      email,
      phone: formData.phone?.trim() || '',
      mobile: formData.phone?.trim() || '',
      password: effectivePassword,
      clubIds: joinClubId ? [joinClubId] : [],
      role: 'member',
      createdAt: new Date().toISOString()
    }
    const ok = await upsertMember(newMember)
    if (!ok) {
      setError(language === 'en' ? 'Registration failed.' : 'فشل التسجيل.')
      return
    }
    if (joinClubId) {
      try {
        const { default: bookingApi } = await import('../api/dbClient')
        await bookingApi.joinClub(joinClubId, newMember.id)
        await addMemberToClub(newMember.id, joinClubId)
      } catch (e) {
        console.warn('Auto-join club after register:', e)
      }
    }
    setCurrentPlatformUser(newMember.id)
    if (returnTo && returnTo.startsWith('/')) {
      navigate(returnTo, { replace: true })
      return
    }
    if (joinClubId) navigate(`/clubs/${joinClubId}`, { replace: true })
    else navigate('/', { replace: true })
  }

  return (
    <div className="register-page">
      <header className="register-header">
        <Link to="/" className="register-logo-link">
          <img src="/logo-playtix.png" alt="PlayTix" className="register-logo" />
        </Link>
        <Link to="/" className="register-back">{c.backToHome}</Link>
        <button type="button" className="register-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} title={language === 'en' ? 'العربية' : 'English'}>
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
        </button>
      </header>
      <main className="register-main">
        <div className="register-card">
          <h1 className="register-title">{c.title}</h1>
          <p className="register-subtitle">{c.subtitle}</p>
          {!isPhoneOnlyFlow && <p className="register-or">{c.or}</p>}
          <form onSubmit={handleSubmit} className="register-form">
            {error && <p className="register-error">{error}</p>}
            {!isPhoneOnlyFlow && (
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
            )}
            {isPhoneOnlyFlow && (
              <div className="form-group">
                <label htmlFor="name">{c.name}</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={c.namePlaceholder}
                  autoComplete="name"
                />
              </div>
            )}
            {!isPhoneOnlyFlow && (
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
            )}
            <div className="form-group">
              <label htmlFor="phone">{c.phone} {isPhoneOnlyFlow ? '*' : ''}</label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder={c.phonePlaceholder}
                required={isPhoneOnlyFlow}
                autoComplete="tel"
              />
            </div>
            {isPhoneOnlyFlow && (
              <p className="register-temp-password-hint">{c.tempPasswordHint}</p>
            )}
            <div className="form-group form-group-checkbox">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="agree-checkbox"
                />
                <span>{c.agreeTerms} <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer">{c.privacyPolicy}</Link> {c.and} <Link to="/terms-of-service" target="_blank" rel="noopener noreferrer">{c.termsOfService}</Link></span>
              </label>
            </div>
            {!isPhoneOnlyFlow && (
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
            )}
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
