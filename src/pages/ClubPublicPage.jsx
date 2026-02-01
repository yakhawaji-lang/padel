import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { loadClubs, getClubById, saveClubs } from '../storage/adminStorage'
import LanguageIcon from '../components/LanguageIcon'
import SocialIcon from '../components/SocialIcon'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import MemberAccountDropdown from '../components/MemberAccountDropdown'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './ClubPublicPage.css'

const getClubBookings = (clubId) => {
  try {
    const club = getClubById(clubId)
    let list = club?.bookings || []
    if (list.length === 0) {
      const raw = localStorage.getItem(`club_${clubId}_bookings`) || localStorage.getItem('bookings')
      if (raw) {
        try {
          const arr = JSON.parse(raw)
          list = Array.isArray(arr)
            ? arr.filter(b => !b.clubId || b.clubId === clubId)
            : []
        } catch (_) {
          list = []
        }
      }
    }
    return list
  } catch (e) {
    return []
  }
}

/** تحويل وقت "HH:mm" إلى دقائق من منتصف الليل */
const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0
  const [h, m] = timeStr.trim().split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** هل الفترة الزمنية (timeSlot) تقع داخل نطاق الحجز [startTime, endTime)؟ */
const isTimeSlotCoveredByBooking = (timeSlot, startTime, endTime) => {
  const slotM = timeToMinutes(timeSlot)
  const startM = timeToMinutes(startTime)
  const endM = timeToMinutes(endTime)
  return slotM >= startM && slotM < endM
}

const getTimeSlotsForClub = (club) => {
  const open = club?.settings?.openingTime
  const close = club?.settings?.closingTime
  const slots = []
  if (!open || !close) {
    for (let hour = 0; hour < 24; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`)
      slots.push(`${String(hour).padStart(2, '0')}:30`)
    }
    return slots
  }
  const [openH, openM] = open.split(':').map(Number)
  const [closeH, closeM] = close.split(':').map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM
  for (let m = openMinutes; m < closeMinutes; m += 30) {
    const h = Math.floor(m / 60) % 24
    const min = m % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return slots
}

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

const ClubPublicPage = () => {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const [club, setClub] = useState(null)
  const [language, setLanguage] = useState(() => {
    const appLang = localStorage.getItem('app_language')
    if (appLang) return appLang
    const c = getClubById(clubId)
    return c?.settings?.defaultLanguage || 'en'
  })
  const [joinStatus, setJoinStatus] = useState(null)
  const [platformUser, setPlatformUser] = useState(null)
  const [courtGridDate, setCourtGridDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  const refreshClub = React.useCallback(() => {
    const c = getClubById(clubId, true)
    setClub(c || null)
  }, [clubId])

  useEffect(() => {
    refreshClub()
  }, [refreshClub])

  useEffect(() => {
    window.addEventListener('clubs-synced', refreshClub)
    return () => window.removeEventListener('clubs-synced', refreshClub)
  }, [refreshClub])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshClub()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshClub])

  useEffect(() => {
    setPlatformUser(getCurrentPlatformUser())
  }, [joinStatus])

  useEffect(() => {
    setPlatformUser(getCurrentPlatformUser())
  }, [])

  useEffect(() => {
    const onMemberUpdate = () => setPlatformUser(getCurrentPlatformUser())
    window.addEventListener('member-updated', onMemberUpdate)
    return () => window.removeEventListener('member-updated', onMemberUpdate)
  }, [])

  const bookings = useMemo(() => getClubBookings(clubId), [clubId])
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  const courtBookings = useMemo(() =>
    bookings
      .filter(b => !b.isTournament && (b.date || b.startDate))
      .map(b => ({ ...b, dateStr: (b.date || b.startDate || '').toString().split('T')[0] }))
      .filter(b => b.dateStr >= today)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr) || (a.startTime || '').localeCompare(b.startTime || ''))
      .slice(0, 30),
    [bookings, today]
  )

  const tournamentBookings = useMemo(() =>
    bookings.filter(b => b.isTournament && (b.date || b.startDate))
      .map(b => ({ ...b, dateStr: (b.date || b.startDate || '').toString().split('T')[0] })),
    [bookings]
  )

  const currentTournaments = useMemo(() =>
    tournamentBookings.filter(b => b.dateStr === today)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [tournamentBookings, today]
  )

  const futureTournaments = useMemo(() =>
    tournamentBookings.filter(b => b.dateStr > today)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr) || (a.startTime || '').localeCompare(b.startTime || ''))
      .slice(0, 20),
    [tournamentBookings, today]
  )

  const storeCategories = useMemo(() => (club?.store?.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)), [club?.store?.categories])
  const storeProducts = useMemo(() => (club?.store?.products || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)), [club?.store?.products])
  const productsByCategory = useMemo(() => {
    const byCat = {}
    storeProducts.forEach(p => {
      const cid = p.categoryId || '_uncategorized'
      if (!byCat[cid]) byCat[cid] = []
      byCat[cid].push(p)
    })
    return byCat
  }, [storeProducts])

  const storeOffers = club?.store?.offers || []
  const getProductPrice = (product, basePriceNum) => {
    const today = new Date().toISOString().split('T')[0]
    const active = storeOffers.filter(o => o.active && (!o.startDate || o.startDate <= today) && (!o.endDate || o.endDate >= today))
    let best = basePriceNum
    active.forEach(o => {
      const matchP = (o.productIds || []).includes(product?.id)
      const matchC = (o.categoryIds || []).includes(product?.categoryId)
      if (!matchP && !matchC) return
      const disc = o.type === 'percentage' ? basePriceNum * (Number(o.value) || 0) / 100 : Math.min(basePriceNum, Number(o.value) || 0)
      const p = basePriceNum - disc
      if (p < best) best = p
    })
    return Math.max(0, best)
  }

  const activeOffers = useMemo(() => {
    const list = (club?.offers || []).slice()
    const todayStr = new Date().toISOString().split('T')[0]
    return list
      .filter(o => o.active !== false)
      .filter(o => !o.validFrom || o.validFrom <= todayStr)
      .filter(o => !o.validUntil || o.validUntil >= todayStr)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  }, [club?.offers])

  if (!club) {
    return (
      <div className="club-public-page">
        <div className="club-public-loading">
          <p>{clubId
            ? (language === 'en' ? 'Club not found.' : 'النادي غير موجود.')
            : (language === 'en' ? 'Loading...' : 'جاري التحميل...')}</p>
          <Link to="/">{language === 'en' ? 'Back to home' : 'العودة للرئيسية'}</Link>
        </div>
      </div>
    )
  }

  const courts = club.courts?.filter(c => !c.maintenance) || []
  const currency = club?.settings?.currency || 'SAR'
  const offers = activeOffers
  const { tournamentsCount, matchesCount } = getClubTournamentStats(club)
  const clubName = language === 'ar' && club.nameAr ? club.nameAr : club.name
  const tagline = language === 'ar' ? (club.taglineAr || club.tagline) : (club.tagline || club.taglineAr)
  const address = club.address ? (language === 'ar' && club.addressAr ? club.addressAr : club.address) : null
  const isMember = platformUser?.clubIds?.includes(club.id) || platformUser?.clubId === club.id

  const heroBgColor = club?.settings?.heroBgColor || '#ffffff'
  const heroBgOpacity = Math.min(1, Math.max(0, (club?.settings?.heroBgOpacity ?? 85) / 100))
  const heroBgStyle = (() => {
    const m = heroBgColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    if (m) return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${heroBgOpacity})`
    return heroBgColor
  })()

  const t = {
    en: {
      backToHome: 'Back to home',
      aboutClub: 'About the club',
      facilities: 'Facilities & courts',
      courtsCount: 'Courts',
      offers: 'Current offers',
      offersFromAdmin: 'Offers from the club',
      contact: 'Contact',
      address: 'Address',
      phone: 'Phone',
      email: 'Email',
      website: 'Website',
      joinClub: 'Join this club',
      joinSuccess: 'You have joined the club successfully.',
      alreadyMember: 'You are already a member of this club.',
      registerFirst: 'Register on the platform first',
      registerThenJoin: 'You must register on the platform before joining a club. Register now, then return here to join.',
      tournaments: 'Tournaments',
      matches: 'Matches',
      members: 'Members',
      bookingsTable: 'Upcoming bookings',
      bookingsEmpty: 'No upcoming court bookings.',
      date: 'Date',
      time: 'Time',
      court: 'Court',
      customer: 'Customer',
      currentTournaments: 'Tournaments today',
      currentTournamentsEmpty: 'No tournaments scheduled for today.',
      futureTournaments: 'Upcoming tournaments',
      futureTournamentsEmpty: 'No upcoming tournaments scheduled.',
      kingOfCourt: 'King of the Court',
      socialTournament: 'Social Tournament',
      validUntil: 'Valid until',
      discount: 'off',
      storeTitle: 'Store',
      storeEmpty: 'No products in the store yet.',
      uncategorized: 'Other',
      sale: 'Sale',
      viewProduct: 'View',
      inStock: 'In stock',
      outOfStock: 'Out of stock',
      courtBooking: 'Court booking',
      selectDate: 'Select date',
      available: 'Available',
      booked: 'Booked'
    },
    ar: {
      backToHome: 'العودة للرئيسية',
      aboutClub: 'عن النادي',
      facilities: 'المرافق والملاعب',
      courtsCount: 'ملاعب',
      offers: 'العروض الحالية',
      offersFromAdmin: 'عروض النادي',
      contact: 'التواصل',
      address: 'العنوان',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      website: 'الموقع',
      joinClub: 'التسجيل كعضو في النادي',
      joinSuccess: 'تم انضمامك للنادي بنجاح.',
      alreadyMember: 'أنت عضو في هذا النادي مسبقاً.',
      registerFirst: 'سجّل في المنصة أولاً',
      registerThenJoin: 'يجب التسجيل في المنصة قبل الانضمام لأي نادي. سجّل الآن ثم عد هنا للانضمام.',
      tournaments: 'بطولات',
      matches: 'مباريات',
      members: 'أعضاء',
      bookingsTable: 'جدول الحجوزات القادمة',
      bookingsEmpty: 'لا توجد حجوزات ملاعب قادمة.',
      date: 'التاريخ',
      time: 'الوقت',
      court: 'الملعب',
      customer: 'العميل',
      currentTournaments: 'البطولات المقامة اليوم',
      currentTournamentsEmpty: 'لا توجد بطولات مجدولة لليوم.',
      futureTournaments: 'البطولات المجدولة القادمة',
      futureTournamentsEmpty: 'لا توجد بطولات مجدولة قادمة.',
      kingOfCourt: 'ملك الملعب',
      socialTournament: 'بطولة سوشيال',
      validUntil: 'صالح حتى',
      discount: 'خصم',
      storeTitle: 'المتجر',
      storeEmpty: 'لا توجد منتجات في المتجر بعد.',
      uncategorized: 'أخرى',
      sale: 'خصم',
      viewProduct: 'عرض',
      inStock: 'متوفر',
      outOfStock: 'غير متوفر',
      courtBooking: 'حجز الملاعب',
      selectDate: 'اختر التاريخ',
      available: 'متاح',
      booked: 'محجوز'
    }
  }
  const c = t[language] || t.en

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    } catch (e) {
      return dateStr
    }
  }

  const tournamentTypeName = (type) => type === 'social' ? c.socialTournament : c.kingOfCourt

  const handleJoinClub = () => {
    if (isMember) {
      setJoinStatus('already')
      return
    }
    if (!platformUser) {
      navigate(`/register?join=${clubId}`)
      return
    }
    try {
      const members = JSON.parse(localStorage.getItem('all_members') || '[]')
      const member = members.find(m => m.id === platformUser.id)
      if (!member) {
        setJoinStatus('error')
        return
      }
      const clubIds = Array.isArray(member.clubIds) ? [...member.clubIds] : (member.clubId ? [member.clubId] : [])
      if (clubIds.includes(club.id)) {
        setJoinStatus('already')
        return
      }
      clubIds.push(club.id)
      member.clubIds = clubIds
      member.clubId = clubIds[0]
      localStorage.setItem('all_members', JSON.stringify(members))
      saveClubs(loadClubs())
      setJoinStatus('success')
      setPlatformUser(getCurrentPlatformUser())
    } catch (e) {
      setJoinStatus('error')
    }
  }

  return (
    <div className="club-public-page commercial">
      <header
        className={`club-public-header${(club?.settings?.headerBgColor || club?.settings?.headerTextColor) ? ' has-custom-header-colors' : ''}`}
        style={{
          ...(club?.settings?.headerBgColor && { background: club.settings.headerBgColor }),
          ...(club?.settings?.headerTextColor && { color: club.settings.headerTextColor })
        }}
      >
        <div className="club-public-header-inner">
          <div className="club-public-header-left">
            {platformUser ? (
              <MemberAccountDropdown
                member={platformUser}
                onUpdate={() => setPlatformUser(getCurrentPlatformUser())}
                language={language}
                className="club-public-member-account"
              />
            ) : (
              <Link to="/" className="club-public-home-link" aria-label={c.backToHome}>⌂</Link>
            )}
          </div>
          <div className="club-public-header-social">
            {club?.settings?.socialLinks?.filter(s => s.url).map((item, idx) => (
              <SocialIcon
                key={idx}
                platform={item.platform || 'facebook'}
                url={item.url}
                iconColor={item.iconColor || '#ffffff'}
                textColor={item.textColor || '#333333'}
                size={36}
                className="club-public-social-icon"
              />
            ))}
          </div>
          <div className="club-public-header-right">
          <button
            type="button"
            className="club-public-lang"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            title={language === 'en' ? 'العربية' : 'English'}
            aria-label={language === 'en' ? 'Switch to Arabic' : 'التبديل للإنجليزية'}
          >
            <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} />
          </button>
          </div>
        </div>
      </header>

      {club.banner ? (
        <section className="club-public-banner club-public-banner-with-hero">
          <img src={club.banner} alt="" className="club-public-banner-image" />
          <div
            className="club-public-hero-overlay"
            style={{
              background: heroBgStyle,
              color: club?.settings?.heroTextColor || '#475569'
            }}
          >
            {club.logo && <img src={club.logo} alt="" className="club-public-logo" />}
            <h1 className="club-public-hero-title" style={{ color: club?.settings?.heroTitleColor || '#0f172a' }}>{clubName}</h1>
            {tagline && <p className="club-public-hero-tagline" style={{ color: club?.settings?.heroTextColor || '#475569' }}>{tagline}</p>}
            <div className="club-public-hero-stats" style={{ color: club?.settings?.heroStatsColor || '#0f172a' }}>
              <span>{courts.length} {c.courtsCount}</span>
              <span>{club.members?.length || 0} {c.members}</span>
              {tournamentsCount > 0 && <span>{tournamentsCount} {c.tournaments}</span>}
              {matchesCount > 0 && <span>{matchesCount} {c.matches}</span>}
            </div>
          </div>
        </section>
      ) : (
        <section className="club-public-hero club-public-hero-standalone">
          <div className="club-public-hero-inner" style={{ background: heroBgStyle, color: club?.settings?.heroTextColor || '#475569' }}>
            {club.logo && <img src={club.logo} alt="" className="club-public-logo" />}
            <h1 className="club-public-title" style={{ color: club?.settings?.heroTitleColor || '#0f172a' }}>{clubName}</h1>
            {tagline && <p className="club-public-tagline" style={{ color: club?.settings?.heroTextColor || '#475569' }}>{tagline}</p>}
            <div className="club-public-stats" style={{ color: club?.settings?.heroStatsColor || '#0f172a' }}>
              <span>{courts.length} {c.courtsCount}</span>
              <span>{club.members?.length || 0} {c.members}</span>
              {tournamentsCount > 0 && <span>{tournamentsCount} {c.tournaments}</span>}
              {matchesCount > 0 && <span>{matchesCount} {c.matches}</span>}
            </div>
          </div>
        </section>
      )}

      <main className="club-public-main">

        <section className="club-public-section club-public-court-booking">
          <div className="club-public-section-inner">
            <div className="club-public-court-booking-header">
              <label className="club-public-court-booking-date-label">{c.selectDate}</label>
              <input
                type="date"
                value={courtGridDate}
                onChange={(e) => setCourtGridDate(e.target.value)}
                className="club-public-court-booking-date-input"
                min={today}
              />
            </div>
            {courts.length === 0 ? (
              <p className="club-public-no-data">{language === 'en' ? 'No courts listed.' : 'لا توجد ملاعب مسجلة.'}</p>
            ) : (() => {
              const timeSlots = getTimeSlotsForClub(club)
              return (
                <div className="club-public-court-booking-wrap" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <div
                    className="club-public-court-grid club-public-court-grid-times-horizontal"
                    style={{
                      gridTemplateColumns: `80px repeat(${timeSlots.length}, minmax(70px, 1fr))`,
                      gridTemplateRows: `44px repeat(${courts.length}, 36px)`,
                      minWidth: `${80 + timeSlots.length * 70}px`
                    }}
                  >
                    <div className="club-public-court-grid-corner" />
                    {timeSlots.map(t => (
                      <div key={t} className="club-public-court-grid-time-header">{t}</div>
                    ))}
                    {courts.map(court => (
                      <React.Fragment key={court.id}>
                        <div className="club-public-court-grid-court-name">
                          {language === 'ar' && court.nameAr ? court.nameAr : court.name}
                        </div>
                        {timeSlots.map(timeSlot => {
                          const courtName = (court.name || '').toString().trim()
                          const dateStr = courtGridDate
                          const isBooked = bookings.some(b => {
                            if (b.isTournament) return false
                            const bDate = (b.date || b.startDate || '').toString().split('T')[0]
                            if (bDate !== dateStr) return false
                            const res = (b.resource || b.court || '').toString().trim()
                            if (res !== courtName) return false
                            const start = (b.startTime || '').toString().trim()
                            let end = (b.endTime || '').toString().trim()
                            if (!end) {
                              const [h, m] = start.split(':').map(Number)
                              const endM = (h || 0) * 60 + (m || 0) + 30
                              end = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
                            }
                            return isTimeSlotCoveredByBooking(timeSlot, start, end)
                          })
                          return (
                            <div
                              key={timeSlot}
                              className={`club-public-court-grid-cell ${isBooked ? 'booked' : 'available'}`}
                              title={isBooked ? c.booked : c.available}
                            >
                              {''}
                            </div>
                          )
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </section>

        <section className="club-public-section club-public-offers">
          <div className="club-public-section-inner">
            {offers.length === 0 ? (
              <p className="club-public-no-data">{language === 'en' ? 'No offers at the moment.' : 'لا توجد عروض حالياً.'}</p>
            ) : (
              <div className="club-public-offers-grid">
                {offers.map((offer, i) => {
                  const title = language === 'ar' ? (offer.titleAr || offer.nameAr || offer.title || offer.name) : (offer.title || offer.name)
                  const desc = language === 'ar' ? (offer.descriptionAr || offer.description) : (offer.description || offer.descriptionAr)
                  return (
                    <div key={offer.id || i} className="club-public-offer-card">
                      {offer.image && <img src={offer.image} alt="" className="club-public-offer-image" />}
                      <h3 className="offer-title">{title}</h3>
                      {desc && <p className="offer-desc">{desc}</p>}
                      <div className="offer-meta">
                        {(offer.discount != null || offer.fixedAmount != null) && (
                          <span className="offer-discount">
                            {offer.discountType === 'fixed' && offer.fixedAmount != null
                              ? `${offer.fixedAmount} ${currency} ${c.discount}`
                              : `${offer.discount}% ${c.discount}`}
                          </span>
                        )}
                        {offer.validUntil && <span className="offer-valid">{c.validUntil} {offer.validUntil}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="club-public-section club-public-about">
          <div className="club-public-section-inner">
            <h2 className="section-heading">{c.aboutClub}</h2>
            <p className="club-public-about-text">
              {tagline || (language === 'en' ? 'Indoor padel courts. King of the Court and Social tournaments. For all levels.' : 'ملاعب بادل داخلية. بطولات ملك الملعب وسوشيال. لجميع المستويات.')}
            </p>
          </div>
        </section>

        <section className="club-public-section club-public-facilities">
          <div className="club-public-section-inner">
            <h2 className="section-heading">{c.facilities}</h2>
            <div className="club-public-courts">
              {(club.courts?.length || 0) > 0 ? (
                (club.courts || []).map(court => (
                  <div key={court.id} className="club-public-court-card">
                    <div className="club-public-court-card-image-wrap">
                      {court.image ? (
                        <img src={court.image} alt="" className="club-public-court-card-image" />
                      ) : (
                        <div className="club-public-court-card-placeholder">
                          <span className="court-placeholder-icon">🏸</span>
                        </div>
                      )}
                      {court.maintenance && <span className="club-public-court-maintenance-badge">{language === 'en' ? 'Maintenance' : 'صيانة'}</span>}
                    </div>
                    <div className="club-public-court-card-body">
                      <span className="court-name">{language === 'ar' && court.nameAr ? court.nameAr : court.name}</span>
                      <span className="court-type">{court.type === 'indoor' ? (language === 'en' ? 'Indoor' : 'داخلي') : (language === 'en' ? 'Outdoor' : 'خارجي')}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="club-public-no-data">{language === 'en' ? 'No courts listed.' : 'لا توجد ملاعب مسجلة.'}</p>
              )}
            </div>
          </div>
        </section>

        <section className="club-public-section club-public-bookings">
          <div className="club-public-section-inner">
            <h2 className="section-heading">{c.bookingsTable}</h2>
            {courtBookings.length === 0 ? (
              <p className="club-public-no-data">{c.bookingsEmpty}</p>
            ) : (
              <div className="club-public-table-wrap">
                <table className="club-public-table">
                  <thead>
                    <tr>
                      <th>{c.date}</th>
                      <th>{c.time}</th>
                      <th>{c.court}</th>
                      <th>{c.customer}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courtBookings.map((b, i) => (
                      <tr key={b.id || i}>
                        <td>{formatDate(b.dateStr)}</td>
                        <td>{(b.startTime || '') + (b.endTime ? ` – ${b.endTime}` : '')}</td>
                        <td>{b.resource || b.courtName || b.court || '—'}</td>
                        <td>{b.memberName || b.customerName || b.customer || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="club-public-section club-public-current-tournaments">
          <div className="club-public-section-inner">
            <h2 className="section-heading">{c.currentTournaments}</h2>
            {currentTournaments.length === 0 ? (
              <p className="club-public-no-data">{c.currentTournamentsEmpty}</p>
            ) : (
              <div className="club-public-tournaments-grid">
                {currentTournaments.map((b, i) => (
                  <div key={b.id || i} className="club-public-tournament-card current">
                    <span className="tournament-type">{tournamentTypeName(b.tournamentType)}</span>
                    <span className="tournament-date">{formatDate(b.dateStr)}</span>
                    <span className="tournament-time">{b.startTime} – {b.endTime}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="club-public-section club-public-future-tournaments">
          <div className="club-public-section-inner">
            <h2 className="section-heading">{c.futureTournaments}</h2>
            {futureTournaments.length === 0 ? (
              <p className="club-public-no-data">{c.futureTournamentsEmpty}</p>
            ) : (
              <div className="club-public-table-wrap">
                <table className="club-public-table">
                  <thead>
                    <tr>
                      <th>{c.date}</th>
                      <th>{c.time}</th>
                      <th>{language === 'en' ? 'Type' : 'النوع'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {futureTournaments.map((b, i) => (
                      <tr key={b.id || i}>
                        <td>{formatDate(b.dateStr)}</td>
                        <td>{b.startTime} – {b.endTime}</td>
                        <td>{tournamentTypeName(b.tournamentType)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {club.storeEnabled && (storeCategories.length > 0 || storeProducts.length > 0) && (
          <section className="club-public-section club-public-store">
            <div className="club-public-section-inner">
              <h2 className="section-heading">
                {language === 'en' ? (club.store?.name || c.storeTitle) : (club.store?.nameAr || club.store?.name || c.storeTitle)}
              </h2>
              {storeProducts.length === 0 ? (
                <p className="club-public-no-data">{c.storeEmpty}</p>
              ) : (
                <div className="club-public-store-by-category">
                  {storeCategories.map(cat => {
                    const prods = productsByCategory[cat.id] || []
                    if (prods.length === 0) return null
                    return (
                      <div key={cat.id} className="store-category-block">
                        <h3 className="store-category-title">
                          {language === 'en' ? cat.name : (cat.nameAr || cat.name)}
                        </h3>
                        <div className="store-products-grid">
                          {prods.map(prod => {
                            const basePrice = parseFloat(prod.price) || 0
                            const salePrice = getProductPrice(prod, basePrice)
                            const hasDiscount = basePrice > 0 && salePrice < basePrice
                            const isOutOfStock = prod.stock != null && prod.stock <= 0
                            return (
                              <div key={prod.id} className={`store-product-card ${hasDiscount ? 'has-sale' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`}>
                                <div className="store-product-image-wrap">
                                  {prod.image ? (
                                    <img src={prod.image} alt="" className="store-product-image" />
                                  ) : (
                                    <div className="store-product-image-placeholder">
                                      <span className="store-product-placeholder-icon">📦</span>
                                    </div>
                                  )}
                                  {hasDiscount && <span className="store-product-sale-badge">{c.sale}</span>}
                                  {prod.stock != null && prod.stock <= 0 && <span className="store-product-stock-badge out">{c.outOfStock}</span>}
                                  {prod.stock != null && prod.stock > 0 && prod.stock <= (club?.store?.minStockAlert ?? 5) && (
                                    <span className="store-product-stock-badge low">{c.inStock}</span>
                                  )}
                                </div>
                                <div className="store-product-body">
                                  <h4 className="store-product-name">{language === 'en' ? prod.name : (prod.nameAr || prod.name)}</h4>
                                  {(prod.description || prod.descriptionAr) && (
                                    <p className="store-product-desc">{language === 'ar' && prod.descriptionAr ? prod.descriptionAr : (prod.description || prod.descriptionAr || '')}</p>
                                  )}
                                  <div className="store-product-price-wrap">
                                    {prod.price != null && prod.price !== '' && (
                                      <>
                                        {hasDiscount && <span className="store-product-price-old">{prod.price} {currency}</span>}
                                        <span className="store-product-price">{salePrice.toFixed(2)} {currency}</span>
                                      </>
                                    )}
                                  </div>
                                  <button type="button" className="store-product-view-btn" disabled={isOutOfStock}>{c.viewProduct}</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {(productsByCategory['_uncategorized'] || []).length > 0 && (
                    <div className="store-category-block">
                      <h3 className="store-category-title">{c.uncategorized}</h3>
                      <div className="store-products-grid">
                        {(productsByCategory['_uncategorized'] || []).map(prod => {
                          const basePrice = parseFloat(prod.price) || 0
                          const salePrice = getProductPrice(prod, basePrice)
                          const hasDiscount = basePrice > 0 && salePrice < basePrice
                          const isOutOfStock = prod.stock != null && prod.stock <= 0
                          return (
                            <div key={prod.id} className={`store-product-card ${hasDiscount ? 'has-sale' : ''} ${isOutOfStock ? 'out-of-stock' : ''}`}>
                              <div className="store-product-image-wrap">
                                {prod.image ? (
                                  <img src={prod.image} alt="" className="store-product-image" />
                                ) : (
                                  <div className="store-product-image-placeholder">
                                    <span className="store-product-placeholder-icon">📦</span>
                                  </div>
                                )}
                                {hasDiscount && <span className="store-product-sale-badge">{c.sale}</span>}
                                {prod.stock != null && prod.stock <= 0 && <span className="store-product-stock-badge out">{c.outOfStock}</span>}
                              </div>
                              <div className="store-product-body">
                                <h4 className="store-product-name">{language === 'en' ? prod.name : (prod.nameAr || prod.name)}</h4>
                                {(prod.description || prod.descriptionAr) && (
                                  <p className="store-product-desc">{language === 'ar' && prod.descriptionAr ? prod.descriptionAr : (prod.description || prod.descriptionAr || '')}</p>
                                )}
                                <div className="store-product-price-wrap">
                                  {prod.price != null && prod.price !== '' && (
                                    <>
                                      {hasDiscount && <span className="store-product-price-old">{prod.price} {currency}</span>}
                                      <span className="store-product-price">{salePrice.toFixed(2)} {currency}</span>
                                    </>
                                  )}
                                </div>
                                <button type="button" className="store-product-view-btn" disabled={isOutOfStock}>{c.viewProduct}</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="club-public-section club-public-contact">
          <div className="club-public-section-inner">
            <h2 className="section-heading">{c.contact}</h2>
            <div className="club-public-contact-grid">
              {address && (
                <div className="contact-item">
                  <span className="contact-label">{c.address}</span>
                  <span className="contact-value">{address}</span>
                </div>
              )}
              {club.phone && (
                <div className="contact-item">
                  <span className="contact-label">{c.phone}</span>
                  <a href={`tel:${club.phone}`} className="contact-value">{club.phone}</a>
                </div>
              )}
              {club.email && (
                <div className="contact-item">
                  <span className="contact-label">{c.email}</span>
                  <a href={`mailto:${club.email}`} className="contact-value">{club.email}</a>
                </div>
              )}
              {club.website && (
                <div className="contact-item">
                  <span className="contact-label">{c.website}</span>
                  <a href={club.website} target="_blank" rel="noopener noreferrer" className="contact-value">{club.website}</a>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="club-public-cta">
          <div className="club-public-cta-inner">
            {joinStatus === 'success' && <p className="club-public-message success">{c.joinSuccess}</p>}
            {joinStatus === 'already' && <p className="club-public-message info">{c.alreadyMember}</p>}
            {joinStatus === 'error' && <p className="club-public-message error">{language === 'en' ? 'Something went wrong. Try again.' : 'حدث خطأ. حاول مرة أخرى.'}</p>}
            {!platformUser && <p className="club-public-register-hint">{c.registerThenJoin}</p>}
            <div className="club-public-cta-buttons">
              {!platformUser && <Link to={`/register?join=${clubId}`} className="btn-register">{c.registerFirst}</Link>}
              <button type="button" className="btn-join-club" onClick={handleJoinClub} disabled={isMember}>
                {isMember ? c.alreadyMember : c.joinClub}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="club-public-footer">
        <Link to="/">{c.backToHome}</Link>
      </footer>
    </div>
  )
}

export default ClubPublicPage
