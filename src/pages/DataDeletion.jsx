import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './LegalPages.css'

const CONTACT_EMAIL = 'y_khawaji@hotmail.com'

const content = {
  en: {
    title: 'User Data Deletion',
    subtitle: 'Instructions and request form for deleting your data from PlayTix',
    lastUpdated: 'Last updated: January 2025',
    intro: 'PlayTix respects your right to control your personal data. You may request deletion of your account and associated data at any time. This page explains the process and allows you to submit a deletion request.',
    sections: [
      { title: '1. What Data We Store', text: 'We store: account information (name, email, phone), club memberships, booking history, tournament participation records, and administrative data if you are a club or platform admin. All data is stored securely and used only as described in our Privacy Policy.' },
      { title: '2. Deletion Process', text: 'Submit a deletion request using the form below. We will verify your identity via the email address associated with your account. Within 30 days, we will permanently delete your data from our systems, except where retention is required by law.' },
      { title: '3. What Happens After Deletion', text: 'Your account will be deactivated. Your data will be removed from our databases. Club administrators may retain limited records (e.g. anonymized transaction logs) where legally permitted. You will no longer be able to access your account or associated services.' },
      { title: '4. Exceptions', text: 'We may retain certain data if required by law, for resolving disputes, or for legitimate business purposes (e.g. fraud prevention). Such retention will be minimal and in accordance with applicable regulations.' },
      { title: '5. Contact', text: `For urgent requests or questions, email us directly at ${CONTACT_EMAIL}. Include "Data Deletion Request" in the subject line.` }
    ],
    formTitle: 'Request Data Deletion',
    formIntro: 'Complete the form below to request deletion of your data. We will process your request within 30 days.',
    accountType: 'Account type',
    accountTypes: { member: 'Platform member', clubAdmin: 'Club admin / owner', platformAdmin: 'Platform admin' },
    email: 'Email address',
    emailPlaceholder: 'Your registered email',
    additionalInfo: 'Additional information (optional)',
    additionalPlaceholder: 'Any details that help us identify your account',
    submit: 'Submit deletion request',
    submitSuccess: 'Your deletion request has been submitted. We will contact you at the provided email to verify and process your request within 30 days.',
    submitError: 'Please enter a valid email address.',
    backToHome: 'Back to home'
  },
  ar: {
    title: 'حذف بيانات المستخدم',
    subtitle: 'تعليمات ونموذج طلب حذف بياناتك من PlayTix',
    lastUpdated: 'آخر تحديث: يناير 2025',
    intro: 'تحترم PlayTix حقك في التحكم في بياناتك الشخصية. يمكنك طلب حذف حسابك والبيانات المرتبطة به في أي وقت. توضح هذه الصفحة العملية وتسمح لك بتقديم طلب حذف.',
    sections: [
      { title: '1. البيانات التي نخزنها', text: 'نخزن: معلومات الحساب (الاسم، البريد، الهاتف)، عضويات النوادي، سجل الحجوزات، سجلات المشاركة في البطولات، والبيانات الإدارية إن كنت مدير نادٍ أو منصة. تُخزن جميع البيانات بشكل آمن وتُستخدم فقط كما هو موضح في سياسة الخصوصية.' },
      { title: '2. عملية الحذف', text: 'قدم طلب حذف باستخدام النموذج أدناه. سنتحقق من هويتك عبر البريد الإلكتروني المرتبط بحسابك. خلال 30 يوماً، سنحذف بياناتك نهائياً من أنظمتنا، باستثناء ما يتطلب القانون الاحتفاظ به.' },
      { title: '3. ما يحدث بعد الحذف', text: 'سيُعطّل حسابك. ستُزال بياناتك من قواعد بياناتنا. قد يحتفظ مدراء النوادي بسجلات محدودة (مثل سجلات المعاملات مجهولة الهوية) حيث يسمح القانون بذلك. لن تتمكن من الوصول إلى حسابك أو الخدمات المرتبطة به.' },
      { title: '4. الاستثناءات', text: 'قد نحتفظ ببيانات معينة إذا تطلب القانون ذلك، أو لتسوية المنازعات، أو لأغراض تجارية مشروعة (مثل منع الاحتيال). سيكون هذا الاحتفاظ ضئيلاً وفقاً للأنظمة المعمول بها.' },
      { title: '5. التواصل', text: `للطلبات العاجلة أو الأسئلة، راسلنا مباشرة على ${CONTACT_EMAIL}. أضف "طلب حذف بيانات" في عنوان الرسالة.` }
    ],
    formTitle: 'طلب حذف البيانات',
    formIntro: 'أكمل النموذج أدناه لطلب حذف بياناتك. سنعالج طلبك خلال 30 يوماً.',
    accountType: 'نوع الحساب',
    accountTypes: { member: 'عضو في المنصة', clubAdmin: 'مدير نادي / مالك', platformAdmin: 'مدير المنصة' },
    email: 'البريد الإلكتروني',
    emailPlaceholder: 'بريدك المسجل',
    additionalInfo: 'معلومات إضافية (اختياري)',
    additionalPlaceholder: 'أي تفاصيل تساعدنا على تحديد حسابك',
    submit: 'إرسال طلب الحذف',
    submitSuccess: 'تم إرسال طلب الحذف. سنتواصل معك على البريد المقدم للتحقق ومعالجة طلبك خلال 30 يوماً.',
    submitError: 'يرجى إدخال بريد إلكتروني صحيح.',
    backToHome: 'العودة للرئيسية'
  }
}

const DataDeletion = () => {
  const [language, setLanguage] = useState(getAppLanguage())
  const [accountType, setAccountType] = useState('member')
  const [email, setEmail] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  const c = content[language]

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(c.submitError)
      return
    }
    const subject = encodeURIComponent('PlayTix Data Deletion Request')
    const body = encodeURIComponent(
      `Data Deletion Request\n\n` +
      `Account type: ${c.accountTypes[accountType]}\n` +
      `Email: ${trimmed}\n` +
      `Additional info: ${additionalInfo || '(none)'}\n\n` +
      `I request permanent deletion of my account and associated data from PlayTix.`
    )
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
    setSubmitted(true)
  }

  return (
    <div className={`legal-page ${language === 'ar' ? 'rtl' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="legal-header">
        <Link to="/" className="legal-logo-link">
          <img src="/logo-playtix.png" alt="PlayTix" className="legal-logo" />
        </Link>
        <nav className="legal-nav">
          <Link to="/">{language === 'en' ? 'Home' : 'الرئيسية'}</Link>
          <Link to="/privacy-policy">{language === 'en' ? 'Privacy Policy' : 'سياسة الخصوصية'}</Link>
          <Link to="/terms-of-service">{language === 'en' ? 'Terms of Service' : 'شروط الخدمة'}</Link>
          <button type="button" className="legal-lang-btn" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={18} />
          </button>
        </nav>
      </header>
      <main className="legal-main">
        <article className="legal-article">
          <h1 className="legal-title">{c.title}</h1>
          <p className="legal-subtitle">{c.subtitle}</p>
          <p className="legal-meta">{c.lastUpdated}</p>
          <p className="legal-intro">{c.intro}</p>
          {c.sections.map((s, i) => (
            <section key={i} className="legal-section">
              <h2 className="legal-section-title">{s.title}</h2>
              <p className="legal-section-text">{s.text}</p>
            </section>
          ))}

          <section className="legal-section legal-form-section">
            <h2 className="legal-section-title">{c.formTitle}</h2>
            <p className="legal-section-text">{c.formIntro}</p>
            {submitted ? (
              <div className="legal-success-box">
                <p>{c.submitSuccess}</p>
                <Link to="/" className="legal-cta-btn">{c.backToHome}</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="legal-deletion-form">
                {error && <p className="legal-form-error">{error}</p>}
                <div className="legal-form-group">
                  <label htmlFor="accountType">{c.accountType} *</label>
                  <select id="accountType" value={accountType} onChange={(e) => setAccountType(e.target.value)} required>
                    <option value="member">{c.accountTypes.member}</option>
                    <option value="clubAdmin">{c.accountTypes.clubAdmin}</option>
                    <option value="platformAdmin">{c.accountTypes.platformAdmin}</option>
                  </select>
                </div>
                <div className="legal-form-group">
                  <label htmlFor="email">{c.email} *</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={c.emailPlaceholder}
                    required
                  />
                </div>
                <div className="legal-form-group">
                  <label htmlFor="additional">{c.additionalInfo}</label>
                  <textarea
                    id="additional"
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    placeholder={c.additionalPlaceholder}
                    rows={3}
                  />
                </div>
                <button type="submit" className="legal-cta-btn legal-cta-danger">{c.submit}</button>
              </form>
            )}
          </section>
        </article>
      </main>
      <footer className="legal-footer">
        <p>© {new Date().getFullYear()} PlayTix. {language === 'en' ? 'All rights reserved.' : 'جميع الحقوق محفوظة.'}</p>
        <Link to="/">{language === 'en' ? 'Back to home' : 'العودة للرئيسية'}</Link>
      </footer>
    </div>
  )
}

export default DataDeletion
