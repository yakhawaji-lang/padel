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
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => setAppLanguage(language), [language])

  const t = {
    en: {
      title: 'Register Your Club',
      subtitle: 'Join PlayTix and manage your padel club professionally. Your registration will be reviewed and activated shortly.',
      sectionClub: 'Club Information',
      sectionAdmin: 'Admin Account',
      sectionDocs: 'Documents',
      sectionLocation: 'Location',
      name: 'Club name (English) *',
      nameAr: 'Club name (Arabic)',
      location: 'Select location on map',
      locationHint: 'Click on the map to set your club location',
      phone: 'Phone / Mobile',
      phonePlaceholder: 'e.g. 05xxxxxxxx',
      email: 'Club email',
      adminEmail: 'Admin login email *',
      adminPassword: 'Password for admin panel *',
      adminHint: 'Use this to login to club dashboard',
      commercialRegister: 'Commercial register number',
      commercialRegisterImage: 'Commercial register document',
      submit: 'Submit Registration',
      backToHome: 'Back to home',
      successTitle: 'Registration Submitted',
      successMsg: 'Your club registration has been received. You can log in now to explore your club dashboard and prepare everything while we review. Full access will be enabled once approved.',
      successCta: 'Go to Club Login',
      namePlaceholder: 'e.g. Ace Padel Club',
      adminEmailPlaceholder: 'admin@club.com',
      passwordPlaceholder: 'Min. 6 characters',
      agreeTerms: 'I agree to the',
      privacyPolicy: 'Privacy Policy',
      and: 'and',
      termsOfService: 'Terms of Service',
      alreadyApproved: 'Already approved?',
      clubLogin: 'Club Login',
      benefitsTitle: 'Why register with PlayTix?',
      benefit1: 'Professional padel club management.',
      benefit2: 'Court bookings and tournaments.',
      benefit2b: 'Member management and rankings.',
      benefit3: 'Accounting & reporting',
      benefit4: 'Bilingual interface',
      benefit5: 'Club store management.'
    },
    ar: {
      title: 'تسجيل نادٍ جديد',
      subtitle: 'انضم إلى PlayTix وأدر نادي البادل بشكل احترافي. سيتم مراجعة تسجيلك وتفعيله قريباً.',
      sectionClub: 'معلومات النادي',
      sectionAdmin: 'حساب المدير',
      sectionDocs: 'المستندات',
      sectionLocation: 'الموقع',
      name: 'اسم النادي (إنجليزي) *',
      nameAr: 'اسم النادي (عربي)',
      location: 'تحديد الموقع على الخريطة',
      locationHint: 'انقر على الخريطة لتحديد موقع النادي',
      phone: 'رقم الجوال / الهاتف',
      phonePlaceholder: 'مثال: 05xxxxxxxx',
      email: 'بريد النادي',
      adminEmail: 'البريد الإلكتروني لتسجيل الدخول *',
      adminPassword: 'كلمة المرور للوحة التحكم *',
      adminHint: 'تُستخدم للدخول إلى لوحة تحكم النادي',
      commercialRegister: 'رقم السجل التجاري',
      commercialRegisterImage: 'وثيقة السجل التجاري',
      submit: 'إرسال التسجيل',
      backToHome: 'العودة للرئيسية',
      successTitle: 'تم إرسال التسجيل',
      successMsg: 'تم استلام طلب تسجيل النادي. يمكنك الدخول الآن لاستكشاف لوحة التحكم وإعداد النادي أثناء المراجعة. سيتم تفعيل الوصول الكامل بعد الموافقة.',
      successCta: 'الذهاب لتسجيل دخول النادي',
      namePlaceholder: 'مثال: هلا بادل',
      adminEmailPlaceholder: 'admin@club.com',
      passwordPlaceholder: '6 أحرف على الأقل',
      agreeTerms: 'أوافق على',
      privacyPolicy: 'سياسة الخصوصية',
      and: 'و',
      termsOfService: 'شروط الخدمة',
      alreadyApproved: 'تمت الموافقة مسبقاً؟',
      clubLogin: 'تسجيل دخول النادي',
      benefitsTitle: 'لماذا التسجيل مع PlayTix؟',
      benefit1: 'إدارة احترافية لأندية بادل.',
      benefit2: 'حجوزات الملاعب و البطولات',
      benefit2b: 'إدارة الأعضاء و التصنيف',
      benefit3: 'المحاسبة والتقارير',
      benefit4: 'واجهة ثنائية اللغة',
      benefit5: 'إدارة متجر النادي.'
    }
  }
  const c = t[language]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const adminEmail = formData.adminEmail || formData.email
    if (!agreeToTerms) {
      setError(language === 'en' ? 'You must agree to the Privacy Policy and Terms of Service.' : 'يجب الموافقة على سياسة الخصوصية وشروط الخدمة.')
      return
    }
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
    setSubmitting(true)
    try {
      const result = await addPendingClub({
        ...formData,
        address: formData.location?.address || '',
        addressAr: formData.location?.address || '',
        adminEmail: adminEmail.trim(),
        adminPassword: formData.adminPassword,
        email: formData.email || adminEmail,
        commercialRegisterImage: formData.commercialRegisterImage || undefined
      })
      if (result?.error === 'EMAIL_EXISTS') {
        setError(language === 'en' ? 'This email is already registered.' : 'هذا البريد مسجّل مسبقاً.')
        return
      }
      if (result?.error === 'SAVE_FAILED') {
        setError(language === 'en' ? 'Server unavailable. Please try again later.' : 'الخادم غير متاح. حاول لاحقاً.')
        return
      }
      setSuccess(true)
    } catch (err) {
      console.error('[RegisterClub] Registration error:', err)
      const msg = String(err?.message || '')
      const isServer = /fetch|network|failed|504|502|500|connection/i.test(msg)
      setError(isServer
        ? (language === 'en' ? 'Server connection failed. Try again later.' : 'فشل الاتصال بالخادم. حاول لاحقاً.')
        : (language === 'en' ? 'An error occurred. Please try again.' : 'حدث خطأ. حاول مرة أخرى.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className={`rc-page rc-success-page ${language === 'ar' ? 'rtl' : ''}`}>
        <header className="rc-header">
          <Link to="/" className="rc-back">{c.backToHome}</Link>
          <Link to="/" className="rc-logo">
            <img src={`${import.meta.env.BASE_URL}logo-playtix.png`} alt="PlayTix" className="rc-logo-img" />
          </Link>
          <button type="button" className="rc-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} aria-label="Language">
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
          </button>
        </header>
        <main className="rc-main rc-success-main">
          <div className="rc-success-card">
            <div className="rc-success-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="3" fill="none" />
                <path d="M20 32l8 8 16-16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <h1>{c.successTitle}</h1>
            <p>{c.successMsg}</p>
            <div className="rc-success-actions">
              <Link to="/club-login" className="rc-btn rc-btn-primary">{c.successCta}</Link>
              <p className="rc-success-hint">
                {language === 'en' ? 'You can log in now to explore your club dashboard while waiting for approval.' : 'يمكنك تسجيل الدخول الآن لاستكشاف لوحة تحكم النادي أثناء انتظار الموافقة.'}
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={`rc-page ${language === 'ar' ? 'rtl' : ''}`}>
      <header className="rc-header">
        <Link to="/" className="rc-back">{c.backToHome}</Link>
        <Link to="/" className="rc-logo">
          <img src={`${import.meta.env.BASE_URL}logo-playtix.png`} alt="PlayTix" className="rc-logo-img" />
        </Link>
        <button type="button" className="rc-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} aria-label="Language">
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={20} />
        </button>
      </header>

      <main className="rc-main">
        <div className="rc-layout">
          <aside className="rc-aside">
            <div className="rc-aside-inner">
              <h2>{c.benefitsTitle}</h2>
              <ul className="rc-benefits">
                <li><span className="rc-benefit-icon">🏆</span>{c.benefit1}</li>
                <li><span className="rc-benefit-icon">📅</span>{c.benefit2}</li>
                <li><span className="rc-benefit-icon">👥</span>{c.benefit2b}</li>
                <li><span className="rc-benefit-icon">💰</span>{c.benefit3}</li>
                <li><span className="rc-benefit-icon">🛒</span>{c.benefit5}</li>
                <li><span className="rc-benefit-icon">🌐</span>{c.benefit4}</li>
              </ul>
              <div className="rc-trust">
                <p>{language === 'en' ? 'Secure registration • Reviewed within 24–48 hours' : 'تسجيل آمن • المراجعة خلال 24–48 ساعة'}</p>
              </div>
            </div>
          </aside>

          <div className="rc-form-wrap">
            <div className="rc-card">
              <div className="rc-card-header">
                <h1>{c.title}</h1>
                <p>{c.subtitle}</p>
              </div>

              <form onSubmit={handleSubmit} className="rc-form">
                {error && (
                  <div className="rc-error" role="alert">
                    <span className="rc-error-icon">!</span>
                    {error}
                  </div>
                )}

                <section className="rc-section">
                  <h3 className="rc-section-title"><span className="rc-section-num">1</span>{c.sectionClub}</h3>
                  <div className="rc-fields rc-fields-row">
                    <div className="rc-field">
                      <label htmlFor="rc-name">{c.name}</label>
                      <input id="rc-name" type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={c.namePlaceholder} required />
                    </div>
                    <div className="rc-field">
                      <label htmlFor="rc-nameAr">{c.nameAr}</label>
                      <input id="rc-nameAr" type="text" value={formData.nameAr} onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })} placeholder="اسم النادي بالعربي" dir="auto" />
                    </div>
                  </div>
                  <div className="rc-fields rc-fields-row">
                    <div className="rc-field">
                      <label htmlFor="rc-phone">{c.phone}</label>
                      <input id="rc-phone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder={c.phonePlaceholder} />
                    </div>
                    <div className="rc-field">
                      <label htmlFor="rc-email">{c.email}</label>
                      <input id="rc-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="club@example.com" />
                    </div>
                  </div>
                </section>

                <section className="rc-section">
                  <h3 className="rc-section-title"><span className="rc-section-num">2</span>{c.sectionAdmin}</h3>
                  <div className="rc-fields">
                    <div className="rc-field">
                      <label htmlFor="rc-adminEmail">{c.adminEmail}</label>
                      <input id="rc-adminEmail" type="email" value={formData.adminEmail || formData.email} onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value, email: formData.email || e.target.value })} placeholder={c.adminEmailPlaceholder} required />
                      <span className="rc-hint">{c.adminHint}</span>
                    </div>
                    <div className="rc-field">
                      <label htmlFor="rc-adminPassword">{c.adminPassword}</label>
                      <div className="rc-password-wrap">
                        <input id="rc-adminPassword" type={showPassword ? 'text' : 'password'} value={formData.adminPassword} onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })} placeholder={c.passwordPlaceholder} required minLength={6} />
                        <button type="button" className="rc-password-toggle" onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Hide' : 'Show'} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                          {showPassword ? '🙈' : '👁'}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rc-section">
                  <h3 className="rc-section-title"><span className="rc-section-num">3</span>{c.sectionDocs}</h3>
                  <div className="rc-fields">
                    <div className="rc-field">
                      <label htmlFor="rc-cr">{c.commercialRegister}</label>
                      <input id="rc-cr" type="text" value={formData.commercialRegister} onChange={(e) => setFormData({ ...formData, commercialRegister: e.target.value })} placeholder={language === 'en' ? 'Commercial register number' : 'رقم السجل التجاري'} />
                    </div>
                    <div className="rc-field">
                      <label>{c.commercialRegisterImage}</label>
                      <div className="rc-upload-row">
                        <input
                          type="text"
                          placeholder={language === 'en' ? 'Image URL' : 'رابط الصورة'}
                          value={typeof formData.commercialRegisterImage === 'string' ? formData.commercialRegisterImage : ''}
                          onChange={(e) => setFormData({ ...formData, commercialRegisterImage: e.target.value })}
                          className="rc-upload-url"
                        />
                        <label className="rc-upload-btn">
                          <input type="file" accept="image/*" hidden onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) {
                              const r = new FileReader()
                              r.onload = () => setFormData(prev => ({ ...prev, commercialRegisterImage: r.result }))
                              r.readAsDataURL(f)
                            }
                            e.target.value = ''
                          }} />
                          {language === 'en' ? 'Upload' : 'رفع'}
                        </label>
                      </div>
                      {formData.commercialRegisterImage && (
                        <div className="rc-preview">
                          <img src={formData.commercialRegisterImage} alt="CR" />
                          <button type="button" className="rc-remove-preview" onClick={() => setFormData(prev => ({ ...prev, commercialRegisterImage: '' }))}>
                            {language === 'en' ? 'Remove' : 'إزالة'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rc-section">
                  <h3 className="rc-section-title"><span className="rc-section-num">4</span>{c.sectionLocation}</h3>
                  <span className="rc-hint rc-hint-block">{c.locationHint}</span>
                  <LocationMapPicker
                    value={formData.location}
                    onChange={(loc) => setFormData(prev => ({ ...prev, location: loc }))}
                    placeholder={language === 'en' ? 'Loading map...' : 'جاري تحميل الخريطة...'}
                    useMyLocationLabel={language === 'en' ? 'Use my location' : 'تحديد موقعي'}
                  />
                </section>

                <div className="rc-agree">
                  <label className="rc-checkbox">
                    <input type="checkbox" checked={agreeToTerms} onChange={(e) => setAgreeToTerms(e.target.checked)} />
                    <span className="rc-checkbox-box" />
                    <span>{c.agreeTerms} <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer">{c.privacyPolicy}</Link> {c.and} <Link to="/terms-of-service" target="_blank" rel="noopener noreferrer">{c.termsOfService}</Link></span>
                  </label>
                </div>

                <button type="submit" className="rc-btn rc-btn-primary rc-btn-submit" disabled={submitting}>
                  {submitting ? (language === 'en' ? 'Submitting...' : 'جاري الإرسال...') : c.submit}
                </button>

                <p className="rc-login-link">
                  {c.alreadyApproved} <Link to="/club-login">{c.clubLogin}</Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default RegisterClub
