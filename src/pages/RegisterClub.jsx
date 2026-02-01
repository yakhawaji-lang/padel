import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import LocationMapPicker from '../components/LocationMapPicker'
import { addPendingClub } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './RegisterClub.css'

const RegisterClub = () => {
  const [language, setLanguage] = useState(getAppLanguage())
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    location: null,
    phone: '',
    email: '',
    adminEmail: '',
    adminPassword: '',
    commercialRegister: '',
    commercialRegisterImage: ''
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
      location: 'Select location on map',
      locationHint: 'Click on the map to set your club location',
      phone: 'Phone',
      email: 'Club email',
      adminEmail: 'Admin login email *',
      adminPassword: 'Password for admin panel *',
      adminHint: 'Use this to login to club dashboard and club page',
      commercialRegister: 'Commercial register number',
      commercialRegisterImage: 'Commercial register document (image)',
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
      location: 'تحديد الموقع على الخريطة',
      locationHint: 'انقر على الخريطة لتحديد موقع النادي',
      phone: 'الهاتف',
      email: 'بريد النادي',
      adminEmail: 'البريد الإلكتروني لتسجيل الدخول *',
      adminPassword: 'كلمة المرور للوحة التحكم *',
      adminHint: 'تُستخدم للدخول إلى لوحة تحكم النادي وصفحة النادي',
      commercialRegister: 'رقم السجل التجاري',
      commercialRegisterImage: 'صورة وثيقة السجل التجاري',
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
      address: formData.location?.address || '',
      addressAr: formData.location?.address || '',
      adminEmail: adminEmail.trim(),
      adminPassword: formData.adminPassword,
      email: formData.email || adminEmail,
      commercialRegisterImage: formData.commercialRegisterImage || undefined
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
            <div className="form-group">
              <label>{c.commercialRegisterImage}</label>
              <div className="form-image-row">
                <input
                  type="text"
                  placeholder={language === 'en' ? 'URL or upload' : 'رابط أو رفع'}
                  value={typeof formData.commercialRegisterImage === 'string' ? formData.commercialRegisterImage : ''}
                  onChange={(e) => setFormData({ ...formData, commercialRegisterImage: e.target.value })}
                  className="form-image-url"
                />
                <label className="btn-secondary btn-upload">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        const r = new FileReader()
                        r.onload = () => setFormData(prev => ({ ...prev, commercialRegisterImage: r.result }))
                        r.readAsDataURL(f)
                      }
                      e.target.value = ''
                    }}
                  />
                  {language === 'en' ? 'Upload' : 'رفع'}
                </label>
              </div>
              {formData.commercialRegisterImage && (
                <div className="form-image-preview">
                  <img src={formData.commercialRegisterImage} alt="CR" />
                  <button type="button" className="btn-remove-img" onClick={() => setFormData(prev => ({ ...prev, commercialRegisterImage: '' }))}>
                    {language === 'en' ? 'Remove' : 'إزالة'}
                  </button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>{c.location}</label>
              <span className="form-hint">{c.locationHint}</span>
              <LocationMapPicker
                value={formData.location}
                onChange={(loc) => setFormData(prev => ({ ...prev, location: loc }))}
                placeholder={language === 'en' ? 'Loading address...' : 'جاري تحميل العنوان...'}
                useMyLocationLabel={language === 'en' ? 'Use my location' : 'تحديد موقعي'}
              />
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
