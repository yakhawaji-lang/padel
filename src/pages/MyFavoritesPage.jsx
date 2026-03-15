/**
 * Manage favorite members for payment sharing — per club.
 * Add/remove favorites; search by full phone (9+ digits) for privacy.
 * +966 fixed for Saudi; professional country selector for others.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { loadClubs, getClubById, getClubMembersFromStorage, getAllMembersFromStorage, refreshClubsFromApi } from '../storage/adminStorage'
import * as bookingApi from '../api/dbClient'
import { getImageUrl } from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import { DEFAULT_COUNTRY, normalizeSearchDigits, getMinDigitsForCountry, normalizeMemberPhone } from '../utils/countryCodes'
import CountryCodeSelect from '../components/CountryCodeSelect'
import './MyFavoritesPage.css'

const MyFavoritesPage = () => {
  const navigate = useNavigate()
  const [member, setMember] = useState(null)
  const [clubs, setClubs] = useState([])
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [selectedClubId, setSelectedClubId] = useState(null)
  const [favoritesByClub, setFavoritesByClub] = useState({})
  const [memberDetailsById, setMemberDetailsById] = useState({})
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY.code)
  const [numberInput, setNumberInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [addingId, setAddingId] = useState(null)

  useEffect(() => {
    setAppLanguage(language)
  }, [language])

  useEffect(() => {
    const user = getCurrentPlatformUser()
    setMember(user)
    if (!user) {
      navigate(`/login?return=${encodeURIComponent('/my-favorites')}`)
      return
    }
  }, [navigate])

  const loadClubsOnce = useCallback(async () => {
    if (!member?.id) return
    await refreshClubsFromApi()
    const clubList = loadClubs() || []
    const myClubIds = member.clubIds || (member.clubId ? [member.clubId] : [])
    const myClubs = clubList.filter(c => myClubIds.some(id => String(id) === String(c.id)))
    setClubs(myClubs)
    setSelectedClubId(prev => (!prev && myClubs.length > 0 ? myClubs[0].id : prev))
  }, [member?.id])

  const loadFavoritesForClub = useCallback(async (clubId) => {
    if (!member?.id || !clubId) return
    try {
      const ids = await bookingApi.getFavoriteMembers(member.id, clubId)
      const allMembers = getAllMembersFromStorage() || []
      const byId = new Map(allMembers.map(m => [String(m.id), m]))
      const clubMembers = getClubMembersFromStorage(clubId) || []
      clubMembers.forEach(m => { if (m?.id) byId.set(String(m.id), m) })
      ;(Array.isArray(ids) ? ids : []).forEach(id => {
        const m = byId.get(String(id)) || allMembers.find(x => String(x.id) === String(id))
        if (m) byId.set(String(id), m)
      })
      setFavoritesByClub(prev => ({ ...prev, [clubId]: Array.isArray(ids) ? ids : [] }))
      setMemberDetailsById(prev => ({ ...prev, ...Object.fromEntries(byId) }))
    } catch (_) {
      setFavoritesByClub(prev => ({ ...prev, [clubId]: [] }))
    }
  }, [member?.id])

  useEffect(() => {
    loadClubsOnce()
  }, [loadClubsOnce])

  useEffect(() => {
    if (selectedClubId && member?.id) {
      loadFavoritesForClub(selectedClubId)
    }
  }, [selectedClubId, member?.id, loadFavoritesForClub])

  useEffect(() => {
    const reload = () => {
      loadClubsOnce()
      if (selectedClubId) loadFavoritesForClub(selectedClubId)
    }
    window.addEventListener('clubs-synced', reload)
    return () => window.removeEventListener('clubs-synced', reload)
  }, [loadClubsOnce, loadFavoritesForClub, selectedClubId])

  const club = selectedClubId ? getClubById(selectedClubId) : null
  const clubMembers = club ? (getClubMembersFromStorage(club.id) || []) : []
  const allPlatformMembers = getAllMembersFromStorage() || []
  const otherMembers = clubMembers.filter(m => String(m?.id) !== String(member?.id))
  const platformNotInClub = (allPlatformMembers || []).filter(
    m => m?.id && String(m.id) !== String(member?.id) && !otherMembers.some(c => String(c?.id) === String(m.id))
  )
  const searchableMembers = [...otherMembers, ...platformNotInClub]
  const searchDigits = normalizeSearchDigits(countryCode, numberInput)
  const minDigits = countryCode.length + getMinDigitsForCountry(countryCode)
  const hasFullPhone = searchDigits.length >= minDigits
  const filteredBySearch = hasFullPhone
    ? searchableMembers.filter(m => {
        const mPhone = normalizeMemberPhone(m?.mobile || m?.phone || '')
        return mPhone && (mPhone.includes(searchDigits) || searchDigits.includes(mPhone))
      })
    : []

  const favoriteIds = new Set((favoritesByClub[selectedClubId] || []).map(String))
  const toggleFavorite = async (memberId, isFavorite) => {
    if (!selectedClubId || !member?.id || !memberId) return
    setActionError('')
    setAddingId(memberId)
    const mid = String(memberId)
    const currentFavs = favoritesByClub[selectedClubId] || []

    if (!isFavorite) {
      const m = searchableMembers.find(x => String(x.id) === mid)
      if (m) {
        setMemberDetailsById(prev => prev[mid] ? prev : { ...prev, [mid]: m })
      }
      setFavoritesByClub(prev => ({
        ...prev,
        [selectedClubId]: [...currentFavs, memberId]
      }))
    } else {
      setFavoritesByClub(prev => ({
        ...prev,
        [selectedClubId]: currentFavs.filter(id => String(id) !== mid)
      }))
    }

    try {
      if (isFavorite) {
        await bookingApi.removeFavoriteMember(member.id, selectedClubId, memberId)
      } else {
        await bookingApi.addFavoriteMember(member.id, selectedClubId, memberId)
      }
    } catch (e) {
      setActionError(e?.message || (language === 'ar' ? 'فشلت العملية. حاول مرة أخرى.' : 'Action failed. Please try again.'))
      setFavoritesByClub(prev => ({
        ...prev,
        [selectedClubId]: currentFavs
      }))
    } finally {
      setAddingId(null)
    }
  }

  const t = (en, ar) => (language === 'ar' ? ar : en)

  if (!member) return null

  return (
    <div className="my-favorites-page">
      <header className="my-favorites-header">
        <Link to="/" className="my-favorites-back">← {t('Home', 'الرئيسية')}</Link>
        <h1>{t('My favorites', 'المفضلة')}</h1>
        <p className="my-favorites-subtitle">
          {t('Members you share payment and bookings with', 'الأعضاء الذين تشارك معهم الدفع والحجز')}
        </p>
        <button
          type="button"
          className="my-favorites-lang-wrap"
          onClick={() => {
            const next = language === 'ar' ? 'en' : 'ar'
            setLanguage(next)
            if (typeof document !== 'undefined') {
              document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
              document.documentElement.lang = next
            }
          }}
          aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
        >
          <LanguageIcon lang={language === 'en' ? 'ar' : 'en'} />
        </button>
      </header>

      <div className="my-favorites-content">
        {clubs.length === 0 ? (
          <p className="my-favorites-empty">{t('You are not a member of any club yet.', 'أنت لست عضواً في أي نادي بعد.')}</p>
        ) : (
          <>
            <div className="my-favorites-clubs">
              {clubs.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`my-favorites-club-tab ${selectedClubId === c.id ? 'active' : ''}`}
                  onClick={() => setSelectedClubId(c.id)}
                >
                  {language === 'ar' ? (c.nameAr || c.name) : (c.name || c.nameAr)}
                </button>
              ))}
            </div>

            {club && (
              <div className="my-favorites-panel">
                <h2>{t('Favorites for', 'المفضلة في')} {language === 'ar' ? (club.nameAr || club.name) : (club.name || club.nameAr)}</h2>

                {actionError && (
                  <p className="my-favorites-error" role="alert">{actionError}</p>
                )}
                <div className="my-favorites-add">
                  <p className="my-favorites-add-hint">
                    {t('Enter full phone number to search and add', 'أدخل رقم الجوال كاملاً للبحث والإضافة')}
                  </p>
                  <div className="my-favorites-phone-row">
                    <CountryCodeSelect
                      value={countryCode}
                      onChange={setCountryCode}
                      language={language}
                      placeholder={t('Search: Saudi Arabia, Egypt, 966...', 'ابحث: السعودية، مصر، 966...')}
                      className="my-favorites-country-select"
                    />
                    <input
                      type="tel"
                      className="my-favorites-number-input"
                      placeholder={countryCode === '966' ? t('5xxxxxxxx', '5xxxxxxxx') : t('Number', 'الرقم')}
                      value={numberInput}
                      onChange={e => setNumberInput(e.target.value.replace(/[^\d]/g, ''))}
                      inputMode="tel"
                      dir="ltr"
                    />
                  </div>
                  {filteredBySearch.length > 0 ? (
                    <div className="my-favorites-results">
                      <p className="my-favorites-results-title">{t('Found members', 'الأعضاء المطابقون')}</p>
                      <div className="my-favorites-results-grid">
                        {filteredBySearch.map(m => {
                          const isFav = favoriteIds.has(String(m.id))
                          return (
                            <div key={m.id} className="my-favorites-member-card">
                              <div className="my-favorites-member-avatar">
                                {m.avatar ? (
                                  <img src={getImageUrl(m.avatar)} alt="" />
                                ) : (
                                  <span className="my-favorites-member-initial">{(m.name || m.email || '?')[0].toUpperCase()}</span>
                                )}
                              </div>
                              <div className="my-favorites-member-info">
                                <span className="my-favorites-member-name">{m.name || m.email || m.id}</span>
                                {(m.mobile || m.phone) && (
                                  <span className="my-favorites-member-phone">{m.mobile || m.phone}</span>
                                )}
                              </div>
                              <button
                                type="button"
                                className={`my-favorites-member-action ${isFav ? 'is-favorite' : ''}`}
                                onClick={() => toggleFavorite(m.id, isFav)}
                                disabled={!!addingId}
                                title={isFav ? t('Remove from favorites', 'إزالة من المفضلة') : t('Add to favorites', 'إضافة للمفضلة')}
                              >
                                {addingId === m.id ? (t('Adding...', 'جاري الإضافة...')) : (isFav ? '★ ' + t('Favorited', 'في المفضلة') : '☆ ' + t('Add', 'إضافة'))}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="my-favorites-search-empty">
                      {hasFullPhone
                        ? t('No members found for this phone number', 'لا توجد نتائج لهذا الرقم')
                        : (countryCode === '966'
                          ? t('Enter 9 digits (5xxxxxxxx)', 'أدخل 9 أرقام (5xxxxxxxx)')
                          : t('Enter full number to search', 'أدخل الرقم كاملاً للبحث'))}
                    </p>
                  )}
                </div>

                <div className="my-favorites-list">
                  <h3>{t('Current favorites', 'المفضلة الحالية')}</h3>
                  {(favoritesByClub[selectedClubId] || []).length === 0 ? (
                    <div className="my-favorites-empty-state">
                      <span className="my-favorites-empty-icon">★</span>
                      <p>{t('No favorites yet. Search above to add.', 'لا توجد مفضلة بعد. ابحث أعلاه للإضافة.')}</p>
                    </div>
                  ) : (
                    <div className="my-favorites-fav-grid">
                      {(favoritesByClub[selectedClubId] || []).map(id => {
                        const m = memberDetailsById[String(id)]
                        return (
                          <div key={id} className="my-favorites-fav-card">
                            <div className="my-favorites-fav-avatar">
                              {m?.avatar ? (
                                <img src={getImageUrl(m.avatar)} alt="" />
                              ) : (
                                <span className="my-favorites-fav-initial">{(m ? (m.name || m.email || id) : id).toString()[0].toUpperCase()}</span>
                              )}
                            </div>
                            <div className="my-favorites-fav-info">
                              <span className="my-favorites-fav-name">{m ? (m.name || m.email || id) : id}</span>
                              {m?.mobile && <span className="my-favorites-fav-phone">{m.mobile}</span>}
                            </div>
                            <button
                              type="button"
                              className="my-favorites-fav-remove"
                              onClick={() => toggleFavorite(id, true)}
                              disabled={!!addingId}
                              title={t('Remove from favorites', 'إزالة من المفضلة')}
                              aria-label={t('Remove', 'إزالة')}
                            >
                              {t('Remove', 'إزالة')}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default MyFavoritesPage
