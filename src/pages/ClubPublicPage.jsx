import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { loadClubs, getClubById, getClubMembersFromStorage, addMemberToClub, addBookingToClub } from '../storage/adminStorage'
import { calculateBookingPrice } from '../utils/bookingPricing'
import LanguageIcon from '../components/LanguageIcon'
import SocialIcon from '../components/SocialIcon'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { getClubAdminSession } from '../storage/clubAuth'
import MemberAccountDropdown from '../components/MemberAccountDropdown'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './ClubPublicPage.css'

const getClubBookings = (clubId) => {
  try {
    const club = getClubById(clubId)
    return club?.bookings && Array.isArray(club.bookings) ? club.bookings : []
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
    const appLang = getAppLanguage()
    if (appLang) return appLang
    const c = getClubById(clubId)
    return c?.settings?.defaultLanguage || 'en'
  })
  const [joinStatus, setJoinStatus] = useState(null)
  const [platformUser, setPlatformUser] = useState(null)
  const [courtGridDate, setCourtGridDate] = useState(() => new Date().toISOString().split('T')[0])
  const [bookingModal, setBookingModal] = useState(null)

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  const refreshClub = React.useCallback(() => {
    loadClubs()
    const c = getClubById(clubId)
    setClub(c || null)
  }, [clubId])

  useEffect(() => {
    refreshClub()
  }, [refreshClub])

  useEffect(() => {
    const onSynced = () => {
      refreshClub()
      setPlatformUser(getCurrentPlatformUser())
    }
    window.addEventListener('clubs-synced', onSynced)
    return () => window.removeEventListener('clubs-synced', onSynced)
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

  const clubMembersList = React.useMemo(() => {
    try {
      return getClubMembersFromStorage(club?.id || '') || []
    } catch (_) {
      return []
    }
  }, [club?.id])

  if (!club) {
    return (
      <div className="club-public-page commercial">
        <div className="club-public-loading" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <p>{clubId
            ? (language === 'en' ? 'Club not found.' : 'النادي غير موجود.')
            : (language === 'en' ? 'Loading...' : 'جاري التحميل...')}</p>
          <Link to="/" style={{ marginTop: 16 }}>{language === 'en' ? 'Back to home' : 'العودة للرئيسية'}</Link>
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
  const isMember = platformUser && (
    platformUser.clubIds?.includes(club.id) ||
    platformUser.clubId === club.id ||
    (Array.isArray(clubMembersList) && clubMembersList.some(m => String(m.id) === String(platformUser.id)))
  )
  const clubAdminSession = getClubAdminSession()
  const isClubAdmin = clubAdminSession && String(clubAdminSession.clubId) === String(clubId)

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
      registerMembers: 'Register as member',
      loginPlatform: 'Login with PlayTix',
      registerThenJoin: 'You must register on PlayTix before joining a club. Register now, then return here to join.',
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
      booked: 'Booked',
      bookNow: 'Book now',
      bookingPrice: 'Price',
      confirmBooking: 'Confirm booking',
      bookingSuccess: 'Booking confirmed!',
      loginToBook: 'Login to book courts',
      courtPrices: 'Court booking prices',
      managePricesLink: 'Manage prices (admin)',
      duration: 'Duration',
      price: 'Price',
      joinPromptTitle: 'You\'re one step away!',
      joinPromptText: 'Join this club now to book courts, participate in tournaments, and enjoy member benefits.',
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
      registerFirst: 'سجّل في PlayTix أولاً',
      registerMembers: 'تسجيل الأعضاء',
      loginPlatform: 'تسجيل الدخول بحساب PlayTix',
      registerThenJoin: 'يجب التسجيل في PlayTix قبل الانضمام لأي نادي. سجّل الآن ثم عد هنا للانضمام.',
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
      booked: 'محجوز',
      bookNow: 'احجز الآن',
      bookingPrice: 'السعر',
      confirmBooking: 'تأكيد الحجز',
      bookingSuccess: 'تم تأكيد الحجز!',
      loginToBook: 'سجّل الدخول لحجز الملاعب',
      courtPrices: 'أسعار حجوزات الملاعب',
      managePricesLink: 'تعديل الأسعار (إداري)',
      duration: 'المدة',
      price: 'السعر',
      joinPromptTitle: 'أنت على بُعد خطوة واحدة!',
      joinPromptText: 'انضم للنادي الآن لحجز الملاعب والمشاركة في البطولات والاستفادة من مزايا العضوية.',
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

  const handleJoinClub = async () => {
    if (isMember) {
      setJoinStatus('already')
      return
    }
    if (!platformUser) {
      navigate(`/register?join=${clubId}`)
      return
    }
    try {
      const ok = await addMemberToClub(platformUser.id, club.id)
      if (ok) {
        setJoinStatus('success')
        setPlatformUser(getCurrentPlatformUser())
        refreshClub()
      } else {
        setJoinStatus('error')
      }
    } catch (e) {
      setJoinStatus('error')
    }
  }

  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingDuration, setBookingDuration] = useState(60)
  const durationOptions = useMemo(() => {
    const dp = club?.settings?.bookingPrices?.durationPrices || [{ durationMinutes: 60, price: 100 }]
    return dp.slice().sort((a, b) => (a.durationMinutes || 0) - (b.durationMinutes || 0))
  }, [club?.settings?.bookingPrices?.durationPrices])

  useEffect(() => {
    if (bookingModal && durationOptions.length > 0) {
      setBookingDuration(durationOptions[0].durationMinutes || 60)
    }
  }, [bookingModal?.dateStr, bookingModal?.startTime, durationOptions])

  const handleConfirmBooking = async () => {
    if (!bookingModal || !platformUser || !isMember) return
    const dur = bookingDuration || 60
    const [h, m] = (bookingModal.startTime || '00:00').split(':').map(Number)
    const endM = (h || 0) * 60 + (m || 0) + dur
    const endTime = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
    const courtName = (bookingModal.court?.name || '').toString().trim()
    const memberName = platformUser.name || platformUser.email || platformUser.displayName || ''
    const priceResult = calculateBookingPrice(club, bookingModal.dateStr, bookingModal.startTime, dur)
    setBookingSubmitting(true)
    try {
      await addBookingToClub(clubId, {
        date: bookingModal.dateStr,
        startDate: bookingModal.dateStr,
        startTime: bookingModal.startTime,
        endTime,
        resource: courtName,
        court: courtName,
        courtName,
        memberId: platformUser.id,
        memberName,
        customerName: memberName,
        customer: memberName,
        price: priceResult.price,
        currency: priceResult.currency,
        durationMinutes: dur
      })
      setBookingModal(null)
      refreshClub()
    } catch (e) {
      console.error('Booking failed:', e)
    } finally {
      setBookingSubmitting(false)
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
              <div className="club-public-auth-links">
                <Link to={`/register?join=${clubId}`} className="club-public-register-link">{c.registerMembers}</Link>
                <Link to={`/login?join=${clubId}`} className="club-public-login-link">{c.loginPlatform}</Link>
              </div>
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
          {club.logo && (
            <div className="club-public-banner-logo-wrap">
              <img src={club.logo} alt="" className="club-public-banner-logo" />
            </div>
          )}
          <div
            className="club-public-hero-overlay"
            style={{
              background: heroBgStyle,
              color: club?.settings?.heroTextColor || '#475569'
            }}
          >
            <h1 className="club-public-hero-title" style={{ color: club?.settings?.heroTitleColor || '#0f172a' }}>{clubName}</h1>
            {tagline && <p className="club-public-hero-tagline" style={{ color: club?.settings?.heroTextColor || '#475569' }}>{tagline}</p>}
            <div className="club-public-hero-stats" style={{ color: club?.settings?.heroStatsColor || '#0f172a' }}>
              <span>{courts.length} {c.courtsCount}</span>
              <span>{clubMembersList.length || club.members?.length || 0} {c.members}</span>
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
              <span>{clubMembersList.length || club.members?.length || 0} {c.members}</span>
              {tournamentsCount > 0 && <span>{tournamentsCount} {c.tournaments}</span>}
              {matchesCount > 0 && <span>{matchesCount} {c.matches}</span>}
            </div>
          </div>
        </section>
      )}

      {platformUser && !isMember && (
        <section className="club-public-join-prompt" role="region" aria-live="polite">
          <div className="club-public-join-prompt-inner">
            <h3 className="club-public-join-prompt-title">{c.joinPromptTitle}</h3>
            <p className="club-public-join-prompt-text">{c.joinPromptText}</p>
            <button type="button" className="club-public-join-prompt-btn" onClick={handleJoinClub}>
              {c.joinClub}
            </button>
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
                          const canBook = !isBooked && isMember && platformUser
                          return (
                            <div
                              key={timeSlot}
                              role={canBook ? 'button' : undefined}
                              tabIndex={canBook ? 0 : undefined}
                              className={`club-public-court-grid-cell ${isBooked ? 'booked' : 'available'} ${canBook ? 'clickable' : ''}`}
                              title={isBooked ? c.booked : canBook ? c.bookNow : c.available}
                              onClick={canBook ? () => setBookingModal({ court, dateStr, startTime: timeSlot }) : undefined}
                              onKeyDown={canBook ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBookingModal({ court, dateStr, startTime: timeSlot }) } } : undefined}
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

        {bookingModal && (
          <div className="club-public-booking-modal-backdrop" onClick={() => !bookingSubmitting && setBookingModal(null)} role="presentation">
            <div className="club-public-booking-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="booking-modal-title">
              <h3 id="booking-modal-title" className="club-public-booking-modal-title">{c.courtBooking}</h3>
              <div className="club-public-booking-modal-body">
                <p className="club-public-booking-modal-row">
                  <span>{c.court}:</span>
                  <strong>{language === 'ar' && bookingModal.court?.nameAr ? bookingModal.court.nameAr : (bookingModal.court?.name || '')}</strong>
                </p>
                <p className="club-public-booking-modal-row">
                  <span>{c.date}:</span>
                  <strong>{formatDate(bookingModal.dateStr)}</strong>
                </p>
                <p className="club-public-booking-modal-row">
                  <span>{c.time}:</span>
                  <strong>{bookingModal.startTime}</strong>
                </p>
                <div className="club-public-booking-modal-row club-public-booking-modal-duration">
                  <label>{c.duration}:</label>
                  <select
                    value={bookingDuration}
                    onChange={e => setBookingDuration(parseInt(e.target.value, 10))}
                    className="club-public-booking-duration-select"
                  >
                    {durationOptions.map(d => (
                      <option key={d.durationMinutes} value={d.durationMinutes}>
                        {d.durationMinutes} {language === 'en' ? 'min' : 'دقيقة'} — {parseFloat(d.price || 0).toFixed(0)} {currency}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="club-public-booking-modal-price">
                  <span>{c.bookingPrice}:</span>
                  <strong className="club-public-booking-modal-price-value">
                    {calculateBookingPrice(club, bookingModal.dateStr, bookingModal.startTime, bookingDuration).price} {currency}
                  </strong>
                </div>
              </div>
              <div className="club-public-booking-modal-actions">
                <button type="button" className="club-public-booking-modal-cancel" onClick={() => !bookingSubmitting && setBookingModal(null)} disabled={bookingSubmitting}>
                  {language === 'en' ? 'Cancel' : 'إلغاء'}
                </button>
                <button type="button" className="club-public-booking-modal-confirm" onClick={handleConfirmBooking} disabled={bookingSubmitting}>
                  {bookingSubmitting ? (language === 'en' ? 'Booking...' : 'جاري الحجز...') : c.confirmBooking}
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="club-public-section club-public-court-prices">
          <div className="club-public-section-inner">
            <h2 className="section-heading">
              <span className="section-heading-icon">💰</span>
              {c.courtPrices}
            </h2>
            {(() => {
              const bp = club?.settings?.bookingPrices || {}
              const durationPrices = bp.durationPrices || [{ durationMinutes: 60, price: 100 }]
              const hasModifiers = (bp.dayModifiers?.length > 0 && bp.dayModifiers.some(d => (d.multiplier || 1) !== 1)) ||
                (bp.timeModifiers?.length > 0 && bp.timeModifiers.some(t => (t.multiplier || 1) !== 1)) ||
                (bp.seasonModifiers?.length > 0 && bp.seasonModifiers.some(s => (s.multiplier || 1) !== 1))
              return (
                <div className="club-public-prices-wrap">
                  <div className="club-public-prices-table-wrap">
                    <table className="club-public-prices-table">
                      <thead>
                        <tr>
                          <th>{c.duration}</th>
                          <th>{c.price}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(durationPrices || []).sort((a, b) => (a.durationMinutes || 0) - (b.durationMinutes || 0)).map((d, i) => (
                          <tr key={i}>
                            <td>{d.durationMinutes} {language === 'en' ? 'min' : 'دقيقة'}</td>
                            <td className="club-public-price-cell">{parseFloat(d.price || 0).toFixed(0)} {currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hasModifiers && (
                    <p className="club-public-prices-note">
                      {language === 'en' ? 'Prices may vary by day, time, and season.' : 'قد تختلف الأسعار حسب اليوم والوقت والموسم.'}
                    </p>
                  )}
                  {isClubAdmin && (
                    <Link to={`/admin/club/${clubId}/booking-prices`} className="club-public-manage-prices-link">
                      {c.managePricesLink}
                    </Link>
                  )}
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
                      <th>{c.price}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courtBookings.map((b, i) => {
                      const dur = b.durationMinutes || (() => {
                        const [sh, sm] = (b.startTime || '0:0').split(':').map(Number)
                        const [eh, em] = (b.endTime || '0:0').split(':').map(Number)
                        return (eh * 60 + em) - (sh * 60 + sm) || 60
                      })()
                      const priceInfo = b.price != null ? { price: b.price, currency: b.currency || currency } : calculateBookingPrice(club, b.dateStr, b.startTime, dur)
                      return (
                        <tr key={b.id || i}>
                          <td>{formatDate(b.dateStr)}</td>
                          <td>{(b.startTime || '') + (b.endTime ? ` – ${b.endTime}` : '')}</td>
                          <td>{b.resource || b.courtName || b.court || '—'}</td>
                          <td>{b.memberName || b.customerName || b.customer || '—'}</td>
                          <td className="club-public-booking-price-cell">{priceInfo.price} {priceInfo.currency}</td>
                        </tr>
                      )
                    })}
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
