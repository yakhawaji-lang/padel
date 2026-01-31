import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { loadClubs } from '../storage/adminStorage'
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
  let list = club?.bookings || []
  if (list.length === 0) {
    try {
      const raw = localStorage.getItem(`club_${club?.id}_bookings`) || localStorage.getItem('bookings')
      if (raw) {
        const arr = JSON.parse(raw)
        list = Array.isArray(arr) ? arr.filter(b => !b.clubId || b.clubId === club?.id) : []
      }
    } catch (e) {}
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming = list.filter(b => new Date(b.date || b.startDate || 0) >= today)
  return { total: list.length, upcoming: upcoming.length }
}

const HomePage = () => {
  const navigate = useNavigate()
  const [clubs, setClubs] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [language, setLanguage] = useState(localStorage.getItem('home_language') || 'en')
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const load = () => setClubs(loadClubs())
    load()
    window.addEventListener('clubs-synced', load)
    return () => window.removeEventListener('clubs-synced', load)
  }, [])

  useEffect(() => {
    localStorage.setItem('home_language', language)
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  const filteredClubs = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return clubs.filter(club =>
      (club.name || '').toLowerCase().includes(q) ||
      (club.nameAr || '').toLowerCase().includes(q) ||
      (club.address || '').toLowerCase().includes(q) ||
      (club.addressAr || '').toLowerCase().includes(q) ||
      (club.tagline || '').toLowerCase().includes(q) ||
      (club.taglineAr || '').toLowerCase().includes(q)
    )
  }, [clubs, searchQuery])

  const allOffers = useMemo(() => {
    const list = []
    clubs.forEach(club => {
      (club?.offers || []).forEach(offer => {
        list.push({
          ...offer,
          clubName: language === 'ar' && club.nameAr ? club.nameAr : club.name
        })
      })
    })
    return list
  }, [clubs, language])

  const globalStats = useMemo(() => {
    let totalCourts = 0
    let totalMembers = 0
    let totalTournaments = 0
    let totalMatches = 0
    let totalBookingsUpcoming = 0
    clubs.forEach(club => {
      totalCourts += club.courts?.filter(c => !c.maintenance).length || 0
      totalMembers += club.members?.length || 0
      const t = getClubTournamentStats(club)
      totalTournaments += t.tournamentsCount
      totalMatches += t.matchesCount
      totalBookingsUpcoming += getClubBookingsCount(club).upcoming
    })
    return {
      clubs: clubs.length,
      courts: totalCourts,
      members: totalMembers,
      tournaments: totalTournaments,
      matches: totalMatches,
      bookingsUpcoming: totalBookingsUpcoming
    }
  }, [clubs])

  const handleAdminLogin = () => navigate('/admin/all-clubs')

  const t = {
    en: {
      siteName: 'Padel Clubs Management',
      nav: {
        home: 'Home',
        services: 'Services',
        features: 'Features',
        about: 'About',
        contact: 'Contact',
        register: 'Register',
        login: 'Login',
        adminLogin: 'Admin Login',
        language: 'Language'
      },
      hero: {
        title: 'Professional management for your padel clubs',
        subtitle: 'One platform to manage tournaments, bookings, members and accounting. Designed for club owners and managers who demand efficiency and clarity.',
        cta: 'Access management dashboard'
      },
      services: {
        title: 'Our services',
        intro: 'We provide a complete suite of tools for padel club operations.',
        items: [
          { title: 'Tournament management', text: 'Schedule and run King of the Court and Social tournaments. Track standings, teams, courts and match history per tournament.' },
          { title: 'Bookings & calendar', text: 'Manage court bookings with a clear weekly or court-based view. Support for local and Playtomic integration.' },
          { title: 'Members & statistics', text: 'Register members, track points, games and tournament history. Full statistics and points history per member.' },
          { title: 'Accounting', text: 'Track revenue, filter by date and court. Overview of paid and pending amounts.' }
        ]
      },
      features: {
        title: 'Why choose our platform',
        intro: 'Built for the real needs of club managers.',
        items: [
          'Multi-club support: manage several clubs from one admin panel.',
          'Bilingual interface: full Arabic and English.',
          'Data stays yours: local storage with optional cloud sync.',
          'Mobile-friendly: use on tablet or phone at the club.'
        ]
      },
      about: {
        title: 'About the platform',
        text: 'This platform is dedicated to padel club management. It enables organisers to schedule tournaments, assign teams to courts, record matches and maintain standings. Bookings and member management are integrated so that daily operations run smoothly from a single, professional interface.'
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
        title: 'Clubs on the platform',
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
        tagline: 'Official platform for padel club management.',
        rights: 'All rights reserved.'
      }
    },
    ar: {
      siteName: 'إدارة أندية البادل',
      nav: {
        home: 'الرئيسية',
        services: 'الخدمات',
        features: 'المميزات',
        about: 'من نحن',
        contact: 'اتصل بنا',
        register: 'تسجيل',
        login: 'تسجيل الدخول',
        adminLogin: 'تسجيل دخول الإدارة',
        language: 'اللغة'
      },
      hero: {
        title: 'إدارة احترافية لأندية البادل',
        subtitle: 'منصة واحدة لإدارة البطولات والحجوزات والأعضاء والمحاسبة. مصممة لمالكي النوادي والمدراء الذين يطلبون الكفاءة والوضوح.',
        cta: 'الدخول إلى لوحة الإدارة'
      },
      services: {
        title: 'خدماتنا',
        intro: 'نقدم مجموعة متكاملة من الأدوات لتشغيل أندية البادل.',
        items: [
          { title: 'إدارة البطولات', text: 'جدولة وإدارة بطولات ملك الملعب وبطولة سوشيال. متابعة الترتيب والفرق والملاعب وسجل المباريات لكل بطولة.' },
          { title: 'الحجوزات والتقويم', text: 'إدارة حجوزات الملاعب بعرض أسبوعي أو حسب الملعب. دعم الحجوزات المحلية وتكامل Playtomic.' },
          { title: 'الأعضاء والإحصائيات', text: 'تسجيل الأعضاء ومتابعة النقاط والألعاب وسجل البطولات. إحصائيات كاملة وسجل نقاط لكل عضو.' },
          { title: 'المحاسبة', text: 'متابعة الإيرادات والتصفية حسب التاريخ والملعب. نظرة على المبالغ المدفوعة والمعلقة.' }
        ]
      },
      features: {
        title: 'لماذا منصتنا',
        intro: 'مصممة وفق احتياجات مدراء النوادي الفعلية.',
        items: [
          'دعم نوادي متعددة: إدارة عدة نوادي من لوحة تحكم واحدة.',
          'واجهة ثنائية اللغة: عربي وإنجليزي كامل.',
          'بياناتك تبقى ملكك: تخزين محلي مع إمكانية المزامنة السحابية.',
          'متوافق مع الجوال: استخدام على جهاز لوحي أو هاتف داخل النادي.'
        ]
      },
      about: {
        title: 'عن المنصة',
        text: 'هذه المنصة مخصصة لإدارة أندية البادل. تتيح للمنظمين جدولة البطولات وتعيين الفرق على الملاعب وتسجيل المباريات والحفاظ على الترتيب. الحجوزات وإدارة الأعضاء مدمجة بحيث تسير العمليات اليومية بسلاسة من واجهة واحدة واحترافية.'
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
        title: 'النوادي على المنصة',
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
        tagline: 'المنصة الرسمية لإدارة أندية البادل.',
        rights: 'جميع الحقوق محفوظة.'
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
            {c.siteName}
          </a>
          <button type="button" className="nav-toggle" aria-label="Menu" onClick={() => setNavOpen(!navOpen)}>
            <span></span><span></span><span></span>
          </button>
          <nav className={`site-nav ${navOpen ? 'open' : ''}`}>
            <a href="#hero" onClick={(e) => { e.preventDefault(); scrollTo('hero') }}>{c.nav.home}</a>
            <a href="#services" onClick={(e) => { e.preventDefault(); scrollTo('services') }}>{c.nav.services}</a>
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features') }}>{c.nav.features}</a>
            <a href="#about" onClick={(e) => { e.preventDefault(); scrollTo('about') }}>{c.nav.about}</a>
            <a href="#clubs" onClick={(e) => { e.preventDefault(); scrollTo('clubs') }}>{language === 'en' ? 'Clubs' : 'النوادي'}</a>
            <span className="nav-sep"></span>
            <a href="/register" className="nav-register">{c.nav.register}</a>
            <a href="/login" className="nav-login">{c.nav.login}</a>
            <button type="button" className="nav-lang" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
              {language === 'en' ? 'العربية' : 'English'}
            </button>
            <button type="button" className="nav-admin" onClick={handleAdminLogin}>
              {c.nav.adminLogin}
            </button>
          </nav>
        </div>
      </header>

      <main>
        {/* قسم دعائي رئيسي */}
        <section id="hero" className="hero">
          <div className="hero-inner">
            <h1 className="hero-title">{c.hero.title}</h1>
            <p className="hero-subtitle">{c.hero.subtitle}</p>
            <button type="button" className="hero-cta" onClick={handleAdminLogin}>
              {c.hero.cta}
            </button>
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
                      {offer.discount != null && <span>{c.offers.discount}: {offer.discount}%</span>}
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
            <p className="section-intro">{language === 'en' ? 'Clubs registered on the platform. Overview of facilities and activity.' : 'النوادي المسجلة على المنصة. نظرة على المرافق والنشاط.'}</p>
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
                const offers = club?.offers || []
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
          <p className="footer-rights">{c.footer.rights}</p>
        </div>
      </footer>
    </div>
  )
}

export default HomePage
