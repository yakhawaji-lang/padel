import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './LegalPages.css'

const content = {
  en: {
    title: 'Terms of Service',
    lastUpdated: 'Last updated: January 2025',
    intro: 'Welcome to PlayTix. By accessing or using our platform, you agree to be bound by these Terms of Service ("Terms"). Please read them carefully. If you do not agree, do not use our services.',
    sections: [
      { title: '1. Acceptance of Terms', text: 'By creating an account, registering a club, or using any PlayTix service, you confirm that you have read, understood, and agree to these Terms and our Privacy Policy. These Terms constitute a legally binding agreement between you and PlayTix.' },
      { title: '2. Description of Service', text: 'PlayTix provides a platform for padel club management, including tournament scheduling, court bookings, member registration, and related administrative tools. We reserve the right to modify, suspend, or discontinue any feature at any time.' },
      { title: '3. Account Registration and Responsibilities', text: 'You must provide accurate and complete information when registering. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account. Notify us immediately of any unauthorized access.' },
      { title: '4. Acceptable Use', text: 'You agree not to use the platform for illegal purposes, to harass others, to distribute malware, or to attempt to gain unauthorized access. We may suspend or terminate accounts that violate these terms. Clubs must comply with applicable local laws and regulations.' },
      { title: '5. Intellectual Property', text: 'PlayTix and its content, design, and software are owned by us or our licensors. You may not copy, modify, distribute, or create derivative works without our written permission. Club names and logos remain the property of their respective owners.' },
      { title: '6. Payment and Fees', text: 'Some features may require payment. Fees will be clearly communicated before any charge. Refund policies apply as stated at the time of purchase. Clubs are responsible for their own pricing and payment collection from members.' },
      { title: '7. Limitation of Liability', text: 'PlayTix is provided "as is." We do not guarantee uninterrupted or error-free service. To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from your use of the platform.' },
      { title: '8. Indemnification', text: 'You agree to indemnify and hold harmless PlayTix, its affiliates, and their officers from any claims, damages, or expenses arising from your use of the service or violation of these Terms.' },
      { title: '9. Termination', text: 'We may terminate or suspend your access at any time for breach of these Terms or for any reason. You may close your account at any time through our Data Deletion page. Upon termination, your right to use the service ceases.' },
      { title: '10. Changes', text: 'We may amend these Terms. Material changes will be communicated via email or platform notice. Continued use after changes constitutes acceptance. We encourage you to review these Terms periodically.' },
      { title: '11. Governing Law and Contact', text: 'These Terms are governed by applicable law. For questions or disputes, contact us at: y_khawaji@hotmail.com' }
    ]
  },
  ar: {
    title: 'شروط الخدمة',
    lastUpdated: 'آخر تحديث: يناير 2025',
    intro: 'مرحباً بك في PlayTix. بالوصول إلى منصتنا أو استخدامها، فإنك توافق على الالتزام بشروط الخدمة هذه ("الشروط"). يرجى قراءتها بعناية. إذا كنت لا توافق، لا تستخدم خدماتنا.',
    sections: [
      { title: '1. قبول الشروط', text: 'بإنشاء حساب أو تسجيل نادٍ أو استخدام أي خدمة من PlayTix، فإنك تؤكد أنك قرأت وفهمت ووافقت على هذه الشروط وسياسة الخصوصية. تشكل هذه الشروط اتفاقية ملزمة قانوناً بينك وبين PlayTix.' },
      { title: '2. وصف الخدمة', text: 'توفر PlayTix منصة لإدارة أندية البادل، تشمل جدولة البطولات وحجوزات الملاعب وتسجيل الأعضاء وأدوات إدارية ذات صلة. نحتفظ بحق تعديل أو تعليق أو إيقاف أي ميزة في أي وقت.' },
      { title: '3. تسجيل الحساب والمسؤوليات', text: 'يجب عليك تقديم معلومات دقيقة وكاملة عند التسجيل. أنت مسؤول عن الحفاظ على سرية بيانات الاعتماد وعن جميع الأنشطة تحت حسابك. أخبرنا فوراً بأي وصول غير مصرح به.' },
      { title: '4. الاستخدام المقبول', text: 'توافق على عدم استخدام المنصة لأغراض غير قانونية، أو مضايقة الآخرين، أو توزيع البرمجيات الخبيثة، أو محاولة الوصول غير المصرح به. قد نعلق أو نُنهي الحسابات المخالفة. يجب على النوادي الامتثال للقوانين والأنظمة المحلية المعمول بها.' },
      { title: '5. الملكية الفكرية', text: 'PlayTix ومحتواها وتصميمها وبرمجياتها مملوكة لنا أو لمرخصينا. لا يجوز لك النسخ أو التعديل أو التوزيع أو إنشاء أعمال مشتقة دون إذننا الكتابي. أسماء النوادي وشعاراتها تبقى ملكاً لأصحابها.' },
      { title: '6. الدفع والرسوم', text: 'قد تتطلب بعض الميزات الدفع. ستُوضح الرسوم بوضوح قبل أي خصم. تنطبق سياسات الاسترداد كما هو مذكور وقت الشراء. النوادي مسؤولة عن تسعيرها وجمع مدفوعات الأعضاء.' },
      { title: '7. تحديد المسؤولية', text: 'يُقدم PlayTix "كما هو". لا نضمن خدمة متواصلة أو خالية من الأخطاء. إلى أقصى حد يسمح به القانون، نحن غير مسؤولين عن الأضرار غير المباشرة أو العرضية أو التبعية الناشئة عن استخدامك للمنصة.' },
      { title: '8. التعويض', text: 'توافق على تعويض وحماية PlayTix وشركاتها التابعة ومسؤوليها من أي مطالبات أو أضرار أو نفقات تنشأ عن استخدامك للخدمة أو انتهاك هذه الشروط.' },
      { title: '9. الإنهاء', text: 'قد نُنهي أو نُعلق وصولك في أي وقت بسبب خرق هذه الشروط أو لأي سبب. يمكنك إغلاق حسابك في أي وقت عبر صفحة حذف البيانات. عند الإنهاء، ينتهي حقك في استخدام الخدمة.' },
      { title: '10. التغييرات', text: 'قد نعدّل هذه الشروط. سيتم إبلاغ التغييرات الجوهرية عبر البريد الإلكتروني أو إشعار على المنصة. استمرار الاستخدام بعد التغييرات يعني القبول. نشجعك على مراجعة هذه الشروط دورياً.' },
      { title: '11. القانون الحاكم والاتصال', text: 'تخضع هذه الشروط للقانون المعمول به. للأسئلة أو المنازعات، تواصل معنا على: y_khawaji@hotmail.com' }
    ]
  }
}

const TermsOfService = () => {
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
          <Link to="/privacy-policy">{language === 'en' ? 'Privacy Policy' : 'سياسة الخصوصية'}</Link>
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

export default TermsOfService
