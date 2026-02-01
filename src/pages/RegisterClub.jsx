import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { addPendingClub } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './RegisterClub.css'

const RegisterClub = () => {
  const navigate = useNavigate()
  const [language, setLanguage] = useState(getAppLanguage())
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    address: '',
    addressAr: '',
    phone: '',
    email: '',
    adminEmail: '',
    adminPassword: '',
    commercialRegister: '',
    website: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => setAppLanguage(language), [language])

  const t = {
    en: {
      title: 'Register Your Club',
      subtitle: 'Join the platform and manage your padel club professionally. Your registration will be reviewed and activated shortly.',
      name: 'Club name (English) *',
      nameAr: 'Club name (Arabic)',
      address: 'Address',
      addressAr: 'Address (Arabic)',
      phone: 'Phone',
      email: 'Club email',
      adminEmail: 'Admin login email *',
      adminPassword: 'Password for admin panel *',
      adminHint: 'Use this to login to club dashboard and club page',
      commercialRegister: 'Commercial register number',
      website: 'Website',
      submit: 'Register Club',
      backToHome: 'Back to home',
      successTitle: 'Registration submitted',
      successMsg: 'Your club registration has been submitted. It will be reviewed by the platform admin. You will be able to login with your email and password once approved.',
      namePlaceholder: 'e.g. Hala Padel',
      adminEmailPlaceholder: 'your@email.com',
      passwordPlaceholder: 'Min. 6 characters'
    },
    ar: {
      title: 'تسجيل نادٍ جديد',
      subtitle: 'انضم للمنصة وأدر نادي البادل بشكل احترافي. سيتم مراجعة تسجيلك وتفعيله قريباً.',
      name: 'اسم النادي (إنجليزي) *',
      nameAr: 'اسم النادي (عربي)',
      address: 'العنوان',
      addressAr: 'العنوان (عربي)',
      phone: 'الهاتف',
      email: 'بريد النادي',
      adminEmail: 'البريد الإلكتروني لتسجيل الدخول *',
      adminPassword: 'كلمة المرور للوحة التحكم *',
      adminHint: 'تُستخدم للدخول إلى لوحة تحكم النادي وصفحة النادي',
      commercialRegister: 'رقم السجل التجاري',
      website: 'الموقع الإلكتروني',
      submit: 'تسجيل النادي',
      backToHome: 'العودة للرئيسية',
      successTitle: 'تم إرسال التسجيل',
      successMsg: 'تم استلام طلب تسجيل النادي. سيتم مراجعته من إدارة المنصة. ستتمكن من الدخول بالبريد وكلمة المرور بعد الموافقة.',
      namePlaceholder: 'مثال: هلا بادل',
      adminEmailPlaceholder: 'بريدك@example.com',
      passwordPlaceholder: '6 أحرف على الأقل'
    }
  }
  const c = t[language]

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const adminEmail = formData.adminEmail || formData.email
    if (!formData.name.trim()) {
      setError(language === 'en' ? 'Club name is required.' : 'اسم النادي مطلوب.')
      return
    }
    if (!adminEmail) {
      setError(language === 'en' ? 'Admin email is required for login.' : 'البريد الإلكتروني مطلوب لتسجيل الدخول.')
      return
    }
    if (!formData.adminPassword || formData.adminPassword.length < 6) {
      setError(language === 'en' ? 'Password must be at least 6 characters.' : 'كلمة المرور 6 أحرف على الأقل.')
      return
    }
    const result = addPendingClub({
      ...formData,
      adminEmail: adminEmail.trim(),
      adminPassword: formData.adminPassword,
      email: formData.email || adminEmail
    })
    if (result.error === 'EMAIL_EXISTS') {
      setError(language === 'en' ? 'This email is already registered.' : 'هذا البريد مسجّل مسبقاً.')
      return
    }
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="register-club-page">
        <header className="register-club-header">
          <Link to="/" className="register-club-back">{c.backToHome}</Link>
          <button type="button" className="register-club-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
          </button>
        </header>
        <main className="register-club-main">
          <div className="register-club-card register-club-success">
            <h1>{c.successTitle}</h1>
            <p>{c.successMsg}</p>
            <Link to="/club-login" className="register-club-btn">{language === 'en' ? 'Go to Club Login' : 'الذهاب لتسجيل دخول النادي'}</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="register-club-page">
      <header className="register-club-header">
        <Link to="/" className="register-club-back">{c.backToHome}</Link>
        <button type="button" className="register-club-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
        </button>
      </header>
      <main className="register-club-main">
        <div className="register-club-card">
          <h1 className="register-club-title">{c.title}</h1>
          <p className="register-club-subtitle">{c.subtitle}</p>
          <form onSubmit={handleSubmit} className="register-club-form">
            {error && <p className="register-club-error">{error}</p>}
            <div className="form-row">
              <div className="form-group">
                <label>{c.name}</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={c.namePlaceholder} required />
              </div>
              <div className="form-group">
                <label>{c.nameAr}</label>
                <input type="text" value={formData.nameAr} onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })} placeholder="اسم النادي بالعربي" />
              </div>
            </div>
            <div className="form-group">
              <label>{c.adminEmail}</label>
              <input type="email" value={formData.adminEmail || formData.email} onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value, email: formData.email || e.target.value })} placeholder={c.adminEmailPlaceholder} required />
              <span className="form-hint">{c.adminHint}</span>
            </div>
            <div className="form-group">
              <label>{c.adminPassword}</label>
              <input type="password" value={formData.adminPassword} onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })} placeholder={c.passwordPlaceholder} required minLength={6} />
            </div>
            <div className="form-group">
              <label>{c.commercialRegister}</label>
              <input type="text" value={formData.commercialRegister} onChange={(e) => setFormData({ ...formData, commercialRegister: e.target.value })} placeholder="رقم السجل التجاري" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{c.address}</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{c.addressAr}</label>
                <input type="text" value={formData.addressAr} onChange={(e) => setFormData({ ...formData, addressAr: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{c.phone}</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{c.email}</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={language === 'en' ? 'club@example.com' : 'النادي@example.com'} />
              </div>
            </div>
            <div className="form-group">
              <label>{c.website}</label>
              <input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://..." />
            </div>
            <button type="submit" className="register-club-submit">{c.submit}</button>
          </form>
          <p className="register-club-login-hint">
            {language === 'en' ? 'Already approved? ' : 'تمت الموافقة مسبقاً؟ '}
            <Link to="/club-login">{language === 'en' ? 'Club Login' : 'تسجيل دخول النادي'}</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default RegisterClub
