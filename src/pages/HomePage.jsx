import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import LanguageIcon from '../components/LanguageIcon'
import { loadClubs } from '../storage/adminStorage'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './HomePage.css'

const getClubTournamentStats = (club) => {
  const data = club?.tournamentData || {}
  const king = data.kingStateByTournamentId || {}
  const social = data.socialStateByTournamentId || {}
  let tournamentsCount = 0
  let matchesCount = 0
  Object.values(king).forEach(s => {
    if (s && (s.teams?.length || s.matches?.length)) {
      tournamentsCount++
      matchesCount += s.matches?.length || 0
    }
  })
  Object.values(social).forEach(s => {
    if (s && (s.teams?.length || s.matches?.length)) {
      tournamentsCount++
      matchesCount += s.matches?.length || 0
    }
  })
  return { tournamentsCount, matchesCount }
}

const getClubBookingsCount = (club) => {
  const list = club?.bookings && Array.isArray(club.bookings) ? club.bookings : []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming = list.filter(b => new Date(b.date || b.startDate || 0) >= today)
  return { total: list.length, upcoming: upcoming.length }
}

const HomePage = () => {
  const navigate = useNavigate()
  const [clubs, setClubs] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [language, setLanguage] = useState(getAppLanguage())
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const load = () => setClubs(loadClubs())
    load()
    window.addEventListener('clubs-synced', load)
    return () => window.removeEventListener('clubs-synced', load)
  }, [])

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  const approvedClubs = useMemo(() => clubs.filter(c => c.status !== 'pending'), [clubs])

  const filteredClubs = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return approvedClubs.filter(club =>
      (club.name || '').toLowerCase().includes(q) ||
      (club.nameAr || '').toLowerCase().includes(q) ||
      (club.address || '').toLowerCase().includes(q) ||
      (club.addressAr || '').toLowerCase().includes(q) ||
      (club.tagline || '').toLowerCase().includes(q) ||
      (club.taglineAr || '').toLowerCase().includes(q)
    )
  }, [approvedClubs, searchQuery])

  const allOffers = useMemo(() => {
    const list = []
    const today = new Date().toISOString().split('T')[0]
    approvedClubs.forEach(club => {
      (club?.offers || [])
        .filter(o => o.active !== false && (!o.validFrom || o.validFrom <= today) && (!o.validUntil || o.validUntil >= today))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .forEach(offer => {
          list.push({
            ...offer,
            clubName: language === 'ar' && club.nameAr ? club.nameAr : club.name,
            currency: club?.settings?.currency || 'SAR'
          })
        })
    })
    return list
  }, [approvedClubs, language])

  const globalStats = useMemo(() => {
    let totalCourts = 0
    let totalMembers = 0
    let totalTournaments = 0
    let totalMatches = 0
    let totalBookingsUpcoming = 0
    approvedClubs.forEach(club => {
      totalCourts += club.courts?.filter(c => !c.maintenance).length || 0
      totalMembers += club.members?.length || 0
      const t = getClubTournamentStats(club)
      totalTournaments += t.tournamentsCount
      totalMatches += t.matchesCount
      totalBookingsUpcoming += getClubBookingsCount(club).upcoming
    })
    return {
      clubs: approvedClubs.length,
      courts: totalCourts,
      members: totalMembers,
      tournaments: totalTournaments,
      matches: totalMatches,
      bookingsUpcoming: totalBookingsUpcoming
    }
  }, [approvedClubs])

  const t = {
    en: {
      siteName: 'PlayTix',
      nav: {
        home: 'Home',
        services: 'Services',
        features: 'Features',
        about: 'About',
        contact: 'Contact',
        register: 'Register',
        login: 'Login',
        language: 'Language'
      },
      hero: {
        title: 'Everything your padel club needs — in one place',
        subtitle: 'PlayTix is the all‑in‑one platform for padel clubs: tournaments, court bookings, member management, club store, and accounting. Run your club like a pro — simple, smart, and scalable.',
        tagline: 'Trusted by clubs across the region',
        cta: 'Get started — free registration'
      },
      services: {
        title: 'What PlayTix offers',
        intro: 'A complete toolkit designed specifically for padel club owners and managers.',
        items: [
          { title: 'Professional tournament management', text: 'Run King of the Court, Social tournaments, and more. Live standings, teams, matches, and rankings — everything in one dashboard.' },
          { title: 'Court bookings & calendar', text: 'Simple weekly and court-based views. Integrate with Playtomic or manage bookings locally. See availability at a glance.' },
          { title: 'Members & rankings', text: 'Register members, track points and games. Full statistics, leaderboards, and points history. Keep your community engaged.' },
          { title: 'Club store', text: 'Sell rackets, balls, apparel, and more. Manage inventory, offers, and sales. Turn your club into a one-stop destination.' },
          { title: 'Accounting & reports', text: 'Track revenue by date, court, and category. Paid vs. pending amounts. Clear reports for better decisions.' }
        ]
      },
      features: {
        title: 'Why clubs choose PlayTix',
        intro: 'Built for the real day-to-day needs of padel club managers.',
        items: [
          'Manage multiple clubs from a single dashboard.',
          'Full bilingual support — Arabic and English.',
          'Your data, your control — secure cloud storage.',
          'Works perfectly on tablet and phone at the club.',
          'Playtomic integration for seamless court bookings.',
          'Professional public pages for each club.'
        ]
      },
      about: {
        title: 'About PlayTix',
        text: 'PlayTix is the leading platform for padel club management in the region. We help club owners and managers run tournaments, handle court bookings, grow their member base, and manage finances — all from one intuitive interface. Whether you run a single court or a multi-venue operation, PlayTix scales with you. Join hundreds of clubs who trust PlayTix to power their daily operations.'
      },
      highlights: {
        title: 'One platform, endless possibilities',
        items: [
          { icon: '⚡', text: 'Set up in minutes — no technical expertise needed' },
          { icon: '📊', text: 'Real-time stats and rankings for every tournament' },
          { icon: '🛒', text: 'Sell products and offers directly to your members' },
          { icon: '🔗', text: 'Connect with Playtomic for integrated bookings' }
        ]
      },
      stats: {
        clubs: 'Clubs',
        courts: 'Courts',
        tournaments: 'Scheduled tournaments',
        matches: 'Matches',
        bookings: 'Upcoming bookings'
      },
      offers: {
        title: 'Current offers from clubs',
        empty: 'No offers at the moment.',
        discount: 'Discount',
        validUntil: 'Valid until'
      },
      clubs: {
        title: 'Clubs on PlayTix',
        searchPlaceholder: 'Search by name, address or description...',
        empty: 'No clubs found.',
        address: 'Address',
        phone: 'Phone',
        email: 'Email',
        website: 'Website',
        courts: 'Courts',
        members: 'Members',
        tournaments: 'Tournaments',
        matches: 'Matches',
        upcomingBookings: 'Upcoming bookings',
        offers: 'Offers',
        taglineDefault: 'Indoor courts. King of the Court and Social tournaments. For all levels.',
        readMore: 'Read more'
      },
      footer: {
        tagline: 'PlayTix — official platform for padel club management.',
        rights: 'All rights reserved.',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
        dataDeletion: 'Data Deletion'
      },
      joinClubs: {
        title: 'Join Padel Clubs',
        text: 'Register your club on PlayTix to manage tournaments, bookings, members and accounting professionally. Your club will be reviewed and activated by the platform admin.',
        cta: 'Register new club',
        login: 'Club Login',
        hint: 'Use email and password to login to club dashboard after approval.'
      },
      joinMembers: {
        title: 'Register as Padel Member',
        text: 'Create a PlayTix account to join clubs with fewer steps, book courts, buy club products and participate in tournaments. Use the same account on the main platform and club pages.',
        cta: 'Register as member',
        createNew: 'Create new member',
        loginMember: 'Member login'
      }
    },
    ar: {
      siteName: 'PlayTix',
      nav: {
        home: 'الرئيسية',
        services: 'الخدمات',
        features: 'المميزات',
        about: 'من نحن',
        contact: 'اتصل بنا',
        register: 'تسجيل',
        login: 'تسجيل الدخول',
        language: 'اللغة'
      },
      hero: {
        title: 'كل ما يحتاجه نادي البادل — في مكان واحد',
        subtitle: 'PlayTix منصة متكاملة لأندية البادل: البطولات، حجوزات الملاعب، إدارة الأعضاء، متجر النادي، والمحاسبة. أدِر ناديك باحترافية — بسيط، ذكي، وقابل للتوسع.',
        tagline: 'موثوق به من نوادي في المنطقة',
        cta: 'ابدأ الآن — تسجيل مجاني'
      },
      services: {
        title: 'ما تقدمه PlayTix',
        intro: 'مجموعة أدوات كاملة مصممة خصيصاً لمالكي ومدراء أندية البادل.',
        items: [
          { title: 'إدارة احترافية للبطولات', text: 'إدارة بطولات ملك الملعب والسوشيال والمزيد. ترتيب مباشر، فرق، مباريات، وتصنيفات — كل شيء في لوحة تحكم واحدة.' },
          { title: 'حجوزات الملاعب والتقويم', text: 'عرض أسبوعي وبحسب الملعب. تكامل مع Playtomic أو إدارة الحجوزات محلياً. شاهد التوفر بنظرة واحدة.' },
          { title: 'الأعضاء والتصنيفات', text: 'تسجيل الأعضاء ومتابعة النقاط والألعاب. إحصائيات كاملة، لوحات ترتيب، وسجل نقاط. حافظ على تفاعل مجتمعك.' },
          { title: 'متجر النادي', text: 'بيع المضارب والكرات والملابس والمزيد. إدارة المخزون والعروض والمبيعات. حوّل ناديك إلى وجهة متكاملة.' },
          { title: 'المحاسبة والتقارير', text: 'متابعة الإيرادات حسب التاريخ والملعب والفئة. المبالغ المدفوعة والمعلقة. تقارير واضحة لقرارات أفضل.' }
        ]
      },
      features: {
        title: 'لماذا تختار النوادي PlayTix',
        intro: 'مصممة وفق الاحتياجات الفعلية اليومية لمدراء أندية البادل.',
        items: [
          'إدارة نوادي متعددة من لوحة تحكم واحدة.',
          'دعم ثنائي اللغة كامل — عربي وإنجليزي.',
          'بياناتك تحت سيطرتك — تخزين سحابي آمن.',
          'يعمل بشكل ممتاز على الجهاز اللوحي والهاتف داخل النادي.',
          'تكامل Playtomic لحجوزات الملاعب بسلاسة.',
          'صفحات عامة احترافية لكل نادٍ.'
        ]
      },
      about: {
        title: 'عن PlayTix',
        text: 'PlayTix المنصة الرائدة لإدارة أندية البادل في المنطقة. نساعد مالكي النوادي والمدراء في إدارة البطولات وحجوزات الملاعب وتنمية قاعدة الأعضاء والمالية — كل ذلك من واجهة سهلة واحدة. سواء تدير ملعباً واحداً أو عدة مراكز، PlayTix يتوسع معك. انضم إلى مئات النوادي التي تثق بـ PlayTix لتشغيل عملياتها اليومية.'
      },
      highlights: {
        title: 'منصة واحدة، إمكانيات لا حدود لها',
        items: [
          { icon: '⚡', text: 'الإعداد خلال دقائق — بدون خبرة تقنية' },
          { icon: '📊', text: 'إحصائيات وترتيب مباشر لكل بطولة' },
          { icon: '🛒', text: 'بيع المنتجات والعروض مباشرة لأعضاء النادي' },
          { icon: '🔗', text: 'اتصال مع Playtomic للحجوزات المدمجة' }
        ]
      },
      stats: {
        clubs: 'نادي',
        courts: 'ملعب',
        tournaments: 'بطولة مجدولة',
        matches: 'مباراة',
        bookings: 'حجوزات قادمة'
      },
      offers: {
        title: 'العروض الحالية من النوادي',
        empty: 'لا توجد عروض حالياً.',
        discount: 'خصم',
        validUntil: 'صالح حتى'
      },
      clubs: {
        title: 'النوادي على PlayTix',
        searchPlaceholder: 'ابحث بالاسم أو العنوان أو الوصف...',
        empty: 'لم يتم العثور على أندية.',
        address: 'العنوان',
        phone: 'الهاتف',
        email: 'البريد الإلكتروني',
        website: 'الموقع',
        courts: 'ملاعب',
        members: 'أعضاء',
        tournaments: 'بطولات',
        matches: 'مباريات',
        upcomingBookings: 'حجوزات قادمة',
        offers: 'عروض',
        taglineDefault: 'ملاعب داخلية. بطولات ملك الملعب وسوشيال. لجميع المستويات.',
        readMore: 'اقرأ المزيد'
      },
      footer: {
        tagline: 'PlayTix — المنصة الرسمية لإدارة أندية البادل.',
        rights: 'جميع الحقوق محفوظة.',
        privacy: 'سياسة الخصوصية',
        terms: 'شروط الخدمة',
        dataDeletion: 'حذف البيانات'
      },
      joinClubs: {
        title: 'الانظمام إلى أندية بادل',
        text: 'سجّل ناديك على PlayTix لإدارة البطولات والحجوزات والأعضاء والمحاسبة بشكل احترافي. سيتم مراجعة النادي وموافقته من إدارة المنصة.',
        cta: 'تسجيل نادي جديد',
        login: 'تسجيل دخول النادي',
        hint: 'استخدم البريد وكلمة المرور للدخول إلى لوحة التحكم بعد الموافقة.'
      },
      joinMembers: {
        title: 'تسجيل أعضاء بادل',
        text: 'أنشئ حساب PlayTix للانضمام للنوادي بخطوات أقل، وحجز الملاعب، وشراء منتجات الأندية، والمشاركة في البطولات. استخدم نفس الحساب في المنصة الرئيسية وصفحات النوادي.',
        cta: 'تسجيل كعضو',
        createNew: 'إنشاء عضو جديد',
        loginMember: 'دخول العضو'
      }
    }
  }

  const c = t[language]

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
    setNavOpen(false)
  }

  return (
    <div className="home-page">
      {/* قائمة علوية احترافية */}
      <header className="site-header">
        <div className="header-inner">
          <a href="#" className="site-logo" onClick={(e) => { e.preventDefault(); scrollTo('hero') }}>
            <img src="/logo-playtix.png" alt="PlayTix" className="site-logo-img" />
          </a>
          <button type="button" className="nav-toggle" aria-label="Menu" onClick={() => setNavOpen(!navOpen)}>
            <span></span><span></span><span></span>
          </button>
          <nav className={`site-nav ${navOpen ? 'open' : ''}`}>
            <div className="site-nav-links">
              <a href="#hero" onClick={(e) => { e.preventDefault(); scrollTo('hero') }}>{c.nav.home}</a>
              <a href="#services" onClick={(e) => { e.preventDefault(); scrollTo('services') }}>{c.nav.services}</a>
              <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features') }}>{c.nav.features}</a>
              <a href="#highlights" onClick={(e) => { e.preventDefault(); scrollTo('highlights') }}>{language === 'en' ? 'Why PlayTix' : 'لماذا PlayTix'}</a>
              <a href="#about" onClick={(e) => { e.preventDefault(); scrollTo('about') }}>{c.nav.about}</a>
              <a href="#join" onClick={(e) => { e.preventDefault(); scrollTo('join') }}>{language === 'en' ? 'Join' : 'انضم'}</a>
              <a href="#clubs" onClick={(e) => { e.preventDefault(); scrollTo('clubs') }}>{language === 'en' ? 'Clubs' : 'النوادي'}</a>
            </div>
            <button type="button" className="nav-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} title={language === 'en' ? 'العربية' : 'English'} aria-label={language === 'en' ? 'Switch to Arabic' : 'التبديل للإنجليزية'}>
              <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} size={18} />
            </button>
          </nav>
        </div>
      </header>

      <main>
        {/* قسم دعائي رئيسي */}
        <section id="hero" className="hero">
          <div className="hero-inner">
            <img src="/logo-playtix.png" alt="PlayTix" className="hero-logo" />
            <h1 className="hero-title">{c.hero.title}</h1>
            <p className="hero-subtitle">{c.hero.subtitle}</p>
            <button type="button" className="hero-cta" onClick={() => scrollTo('join')}>
              {c.hero.cta}
            </button>
            <p className="hero-tagline">{c.hero.tagline}</p>
          </div>
        </section>

        {/* إحصائيات بأرقام ونصوص فقط */}
        <section className="stats-bar">
          <div className="stats-inner">
            <div className="stat"><span className="stat-num">{globalStats.clubs}</span><span className="stat-label">{c.stats.clubs}</span></div>
            <div className="stat"><span className="stat-num">{globalStats.courts}</span><span className="stat-label">{c.stats.courts}</span></div>
            <div className="stat"><span className="stat-num">{globalStats.tournaments}</span><span className="stat-label">{c.stats.tournaments}</span></div>
            <div className="stat"><span className="stat-num">{globalStats.matches}</span><span className="stat-label">{c.stats.matches}</span></div>
            <div className="stat"><span className="stat-num">{globalStats.bookingsUpcoming}</span><span className="stat-label">{c.stats.bookings}</span></div>
          </div>
        </section>

        {/* قسمان متجاوران: الانظمام للنوادي + تسجيل الأعضاء */}
        <section id="join" className="section section-join">
          <div className="section-inner">
            <div className="join-cards">
              <div className="join-card join-card-clubs">
                <div className="join-card-icon">🏢</div>
                <h3 className="join-card-title">{c.joinClubs.title}</h3>
                <p className="join-card-text">{c.joinClubs.text}</p>
                <p className="join-card-hint">{c.joinClubs.hint}</p>
                <div className="join-card-btns">
                  <Link to="/register-club" className="join-card-cta btn-primary">
                    {c.joinClubs.cta}
                  </Link>
                  <Link to="/club-login" className="join-card-cta btn-outline">
                    {c.joinClubs.login}
                  </Link>
                </div>
              </div>
              <div className="join-card join-card-members">
                <div className="join-card-icon">👥</div>
                <h3 className="join-card-title">{c.joinMembers.title}</h3>
                <p className="join-card-text">{c.joinMembers.text}</p>
                <div className="join-card-actions join-card-btns">
                  <Link to="/register" className="join-card-cta btn-primary">
                    {c.joinMembers.createNew}
                  </Link>
                  <Link to="/login" className="join-card-cta btn-outline">
                    {c.joinMembers.loginMember}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* نقاط بارزة */}
        <section id="highlights" className="section section-highlights">
          <div className="section-inner">
            <h2 className="section-title">{c.highlights.title}</h2>
            <div className="highlights-grid">
              {c.highlights.items.map((item, i) => (
                <div key={i} className="highlight-card">
                  <span className="highlight-icon">{item.icon}</span>
                  <p className="highlight-text">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* الخدمات */}
        <section id="services" className="section section-services">
          <div className="section-inner">
            <h2 className="section-title">{c.services.title}</h2>
            <p className="section-intro">{c.services.intro}</p>
            <div className="services-grid">
              {c.services.items.map((item, i) => (
                <div key={i} className="service-card">
                  <h3 className="service-title">{item.title}</h3>
                  <p className="service-text">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* المميزات */}
        <section id="features" className="section section-features">
          <div className="section-inner">
            <h2 className="section-title">{c.features.title}</h2>
            <p className="section-intro">{c.features.intro}</p>
            <ul className="features-list">
              {c.features.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* من نحن */}
        <section id="about" className="section section-about">
          <div className="section-inner">
            <h2 className="section-title">{c.about.title}</h2>
            <p className="about-text">{c.about.text}</p>
          </div>
        </section>

        {/* العروض */}
        {allOffers.length > 0 && (
          <section id="offers" className="section section-offers">
            <div className="section-inner">
              <h2 className="section-title">{c.offers.title}</h2>
              <div className="offers-grid">
                {allOffers.map((offer, i) => (
                  <div key={offer.id || i} className="offer-card">
                    <span className="offer-club">{offer.clubName}</span>
                    <h3 className="offer-title">{offer.title || offer.name}</h3>
                    {offer.description && <p className="offer-desc">{offer.description}</p>}
                    <div className="offer-meta">
                      {(offer.discount != null || offer.fixedAmount != null) && (
                        <span>
                          {c.offers.discount}: {offer.discountType === 'fixed' && offer.fixedAmount != null
                            ? `${offer.fixedAmount} ${offer.currency || 'SAR'}`
                            : `${offer.discount}%`}
                        </span>
                      )}
                      {offer.validUntil && <span>{c.offers.validUntil}: {offer.validUntil}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* النوادي */}
        <section id="clubs" className="section section-clubs">
          <div className="section-inner">
            <h2 className="section-title">{c.clubs.title}</h2>
            <p className="section-intro">{language === 'en' ? 'Clubs registered on PlayTix. Overview of facilities and activity.' : 'النوادي المسجلة على PlayTix. نظرة على المرافق والنشاط.'}</p>
            <div className="clubs-search-wrap">
              <input
                type="text"
                className="clubs-search"
                placeholder={c.clubs.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={c.clubs.searchPlaceholder}
              />
            </div>
            <div className="clubs-grid">
              {filteredClubs.map(club => {
                const courts = club.courts?.filter(c => !c.maintenance).length || 0
                const members = club.members?.length || 0
                const { tournamentsCount, matchesCount } = getClubTournamentStats(club)
                const { upcoming } = getClubBookingsCount(club)
                const tagline = language === 'ar' ? (club.taglineAr || club.tagline) : (club.tagline || club.taglineAr)
                const todayStr = new Date().toISOString().split('T')[0]
                const offers = (club?.offers || []).filter(o => o.active !== false && (!o.validFrom || o.validFrom <= todayStr) && (!o.validUntil || o.validUntil >= todayStr))
                const clubName = language === 'ar' && club.nameAr ? club.nameAr : club.name
                const clubAddress = club.address ? (language === 'ar' && club.addressAr ? club.addressAr : club.address) : null

                return (
                  <article key={club.id} className="club-card">
                    <div className="club-card-header">
                      {club.logo && <img src={club.logo} alt="" className="club-card-logo" />}
                      <h3 className="club-card-title">{clubName}</h3>
                      {club.playtomicVenueId && <span className="club-card-badge">Playtomic</span>}
                    </div>
                    <p className="club-card-tagline">{tagline || c.clubs.taglineDefault}</p>
                    <div className="club-card-stats">
                      <div className="club-stat"><span className="club-stat-value">{courts}</span><span className="club-stat-label">{c.clubs.courts}</span></div>
                      <div className="club-stat"><span className="club-stat-value">{members}</span><span className="club-stat-label">{c.clubs.members}</span></div>
                      {tournamentsCount > 0 && (
                        <div className="club-stat"><span className="club-stat-value">{tournamentsCount}</span><span className="club-stat-label">{c.clubs.tournaments}</span></div>
                      )}
                      {matchesCount > 0 && (
                        <div className="club-stat"><span className="club-stat-value">{matchesCount}</span><span className="club-stat-label">{c.clubs.matches}</span></div>
                      )}
                      {upcoming > 0 && (
                        <div className="club-stat"><span className="club-stat-value">{upcoming}</span><span className="club-stat-label">{c.clubs.upcomingBookings}</span></div>
                      )}
                    </div>
                    <div className="club-card-details">
                      {clubAddress && (
                        <div className="club-detail-row">
                          <span className="club-detail-label">{c.clubs.address}</span>
                          <span className="club-detail-value">{clubAddress}</span>
                        </div>
                      )}
                      {club.phone && (
                        <div className="club-detail-row">
                          <span className="club-detail-label">{c.clubs.phone}</span>
                          <span className="club-detail-value">{club.phone}</span>
                        </div>
                      )}
                      {club.email && (
                        <div className="club-detail-row">
                          <span className="club-detail-label">{c.clubs.email}</span>
                          <span className="club-detail-value">{club.email}</span>
                        </div>
                      )}
                      {club.website && (
                        <div className="club-detail-row">
                          <span className="club-detail-label">{c.clubs.website}</span>
                          <a href={club.website} target="_blank" rel="noopener noreferrer" className="club-detail-link">{club.website}</a>
                        </div>
                      )}
                      {offers.length > 0 && (
                        <div className="club-card-offers">
                          <span className="club-offers-label">{c.clubs.offers}</span>
                          <div className="club-offers-list">
                            {offers.slice(0, 3).map((o, i) => (
                              <span key={o.id || i} className="club-offer-chip">{o.title || o.name}{o.discount != null ? ` · ${o.discount}%` : ''}</span>
                            ))}
                            {offers.length > 3 && <span className="club-offer-chip club-offer-more">+{offers.length - 3}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="club-card-footer">
                      <Link to={`/clubs/${club.id}`} className="club-card-read-more">
                        {c.clubs.readMore}
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
            {filteredClubs.length === 0 && (
              <p className="section-empty">{c.clubs.empty}</p>
            )}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <p className="footer-tagline">{c.siteName} — {c.footer.tagline}</p>
          <nav className="footer-links">
            <Link to="/privacy-policy">{c.footer.privacy}</Link>
            <Link to="/terms-of-service">{c.footer.terms}</Link>
            <Link to="/data-deletion">{c.footer.dataDeletion}</Link>
          </nav>
          <p className="footer-rights">{c.footer.rights}</p>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
