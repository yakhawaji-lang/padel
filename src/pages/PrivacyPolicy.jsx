import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './LegalPages.css'

const content = {
  en: {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: January 2025',
    intro: 'PlayTix ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform and services.',
    sections: [
      { title: '1. Information We Collect', text: 'We collect information you provide directly (name, email, phone), information from your use of our services (bookings, tournament participation, club memberships), and technical data (IP address, browser type, device information) for security and analytics.' },
      { title: '2. How We Use Your Information', text: 'We use your information to provide and improve our services, process bookings and memberships, communicate with you, ensure platform security, and comply with legal obligations. We do not sell your personal data to third parties.' },
      { title: '3. Data Sharing and Disclosure', text: 'We may share data with club administrators for the clubs you join, with service providers who assist our operations (under strict confidentiality), and when required by law or to protect our rights and safety.' },
      { title: '4. Data Security', text: 'We implement industry-standard security measures to protect your data. Passwords are hashed, and sensitive data is encrypted in transit and at rest. We regularly review and update our security practices.' },
      { title: '5. Your Rights', text: 'You have the right to access, correct, or delete your personal data. You may request a copy of your data or its deletion at any time through our Data Deletion page. Contact us at the email below for assistance.' },
      { title: '6. Cookies and Tracking', text: 'We use essential cookies for authentication and session management. We may use analytics to improve our services. You can manage cookie preferences through your browser settings.' },
      { title: '7. Children\'s Privacy', text: 'Our services are not directed to individuals under 16. We do not knowingly collect personal data from children. If you believe we have collected such data, please contact us immediately.' },
      { title: '8. Changes to This Policy', text: 'We may update this Privacy Policy periodically. We will notify you of significant changes via email or a notice on our platform. Your continued use constitutes acceptance of the updated policy.' },
      { title: '9. Contact Us', text: 'For privacy-related inquiries or to exercise your rights, contact us at: y_khawaji@hotmail.com' }
    ]
  },
  ar: {
    title: 'سياسة الخصوصية',
    lastUpdated: 'آخر تحديث: يناير 2025',
    intro: 'PlayTix ("نحن") ملتزمون بحماية خصوصيتك. توضح سياسة الخصوصية هذه كيفية جمعنا واستخدامنا والإفصاح عن بياناتك وحمايتها عند استخدامك لمنصتنا وخدماتنا.',
    sections: [
      { title: '1. المعلومات التي نجمعها', text: 'نجمع المعلومات التي تقدمها مباشرة (الاسم، البريد الإلكتروني، الهاتف)، ومعلومات من استخدامك لخدماتنا (الحجوزات، المشاركة في البطولات، العضوية في الأندية)، والبيانات التقنية (عنوان IP، نوع المتصفح) لأغراض الأمان والتحليل.' },
      { title: '2. كيفية استخدامنا لمعلوماتك', text: 'نستخدم معلوماتك لتقديم وتحسين خدماتنا، ومعالجة الحجوزات والعضويات، والتواصل معك، وضمان أمان المنصة، والالتزام بالالتزامات القانونية. لا نبيع بياناتك الشخصية لأطراف ثالثة.' },
      { title: '3. مشاركة البيانات والإفصاح', text: 'قد نشارك البيانات مع إداريي النوادي للنوادي التي تنضم إليها، ومع مزودي الخدمات الذين يساعدون عملياتنا (تحت سرية صارمة)، وعندما يقتضي القانون ذلك أو لحماية حقوقنا وسلامتنا.' },
      { title: '4. أمان البيانات', text: 'نطبق إجراءات أمان وفق معايير الصناعة لحماية بياناتك. كلمات المرور مشفرة، والبيانات الحساسة مُشفرة أثناء النقل والتخزين. نراجع ونحدّث ممارساتنا الأمنية بانتظام.' },
      { title: '5. حقوقك', text: 'لديك الحق في الوصول إلى بياناتك الشخصية أو تصحيحها أو حذفها. يمكنك طلب نسخة من بياناتك أو حذفها في أي وقت عبر صفحة حذف البيانات. اتصل بنا على البريد أدناه للمساعدة.' },
      { title: '6. ملفات تعريف الارتباط والتتبع', text: 'نستخدم ملفات تعريف ارتباط ضرورية للمصادقة وإدارة الجلسات. قد نستخدم التحليلات لتحسين خدماتنا. يمكنك إدارة تفضيلات ملفات التعريف من خلال إعدادات المتصفح.' },
      { title: '7. خصوصية الأطفال', text: 'خدماتنا غير موجهة لمن تقل أعمارهم عن 16 عاماً. لا نجمع بيانات شخصية من الأطفال عن قصد. إن كنت تعتقد أننا جمعنا مثل هذه البيانات، يرجى الاتصال بنا فوراً.' },
      { title: '8. التغييرات على هذه السياسة', text: 'قد نحدّث سياسة الخصوصية دورياً. سنخطرك بالتغييرات الجوهرية عبر البريد الإلكتروني أو إشعار على المنصة. استمرار استخدامك يعني قبول السياسة المحدثة.' },
      { title: '9. اتصل بنا', text: 'للاستفسارات المتعلقة بالخصوصية أو لممارسة حقوقك، تواصل معنا على: y_khawaji@hotmail.com' }
    ]
  }
}

const PrivacyPolicy = () => {
  const [language, setLanguage] = useState(getAppLanguage())

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  const c = content[language]

  return (
    <div className={`legal-page ${language === 'ar' ? 'rtl' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="legal-header">
        <Link to="/" className="legal-logo-link">
          <img src="/logo-playtix.png" alt="PlayTix" className="legal-logo" />
        </Link>
        <nav className="legal-nav">
          <Link to="/">{language === 'en' ? 'Home' : 'الرئيسية'}</Link>
          <Link to="/terms-of-service">{language === 'en' ? 'Terms of Service' : 'شروط الخدمة'}</Link>
          <Link to="/data-deletion">{language === 'en' ? 'Data Deletion' : 'حذف البيانات'}</Link>
          <button type="button" className="legal-lang-btn" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={18} />
          </button>
        </nav>
      </header>
      <main className="legal-main">
        <article className="legal-article">
          <h1 className="legal-title">{c.title}</h1>
          <p className="legal-meta">{c.lastUpdated}</p>
          <p className="legal-intro">{c.intro}</p>
          {c.sections.map((s, i) => (
            <section key={i} className="legal-section">
              <h2 className="legal-section-title">{s.title}</h2>
              <p className="legal-section-text">{s.text}</p>
            </section>
          ))}
        </article>
      </main>
      <footer className="legal-footer">
        <p>© {new Date().getFullYear()} PlayTix. {language === 'en' ? 'All rights reserved.' : 'جميع الحقوق محفوظة.'}</p>
        <Link to="/">{language === 'en' ? 'Back to home' : 'العودة للرئيسية'}</Link>
      </footer>
    </div>
  )
}

export default PrivacyPolicy
