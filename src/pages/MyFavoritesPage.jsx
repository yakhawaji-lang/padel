/**
 * Manage favorite members for payment sharing — per club.
 * Add/remove favorites; search by full phone (9+ digits) for privacy.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCurrentPlatformUser } from '../storage/platformAuth'
import { loadClubs, getClubById, getClubMembersFromStorage, getAllMembersFromStorage, refreshClubsFromApi } from '../storage/adminStorage'
import * as bookingApi from '../api/dbClient'
import LanguageIcon from '../components/LanguageIcon'
import { getAppLanguage, setAppLanguage } from '../storage/languageStorage'
import './MyFavoritesPage.css'

function phoneDigits(s) {
  return (s || '').replace(/\D/g, '')
}

const FULL_PHONE_MIN = 9

const MyFavoritesPage = () => {
  const navigate = useNavigate()
  const [member, setMember] = useState(null)
  const [clubs, setClubs] = useState([])
  const [language, setLanguage] = useState(() => getAppLanguage())
  const [selectedClubId, setSelectedClubId] = useState(null)
  const [favoritesByClub, setFavoritesByClub] = useState({})
  const [memberDetailsById, setMemberDetailsById] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

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

  const loadFavorites = useCallback(async () => {
    if (!member?.id) return
    await refreshClubsFromApi()
    const clubList = loadClubs() || []
    const myClubIds = member.clubIds || (member.clubId ? [member.clubId] : [])
    const myClubs = clubList.filter(c => myClubIds.some(id => String(id) === String(c.id)))
    setClubs(myClubs)
    if (!selectedClubId && myClubs.length > 0) setSelectedClubId(myClubs[0].id)

    const favs = {}
    const allMembers = getAllMembersFromStorage() || []
    const byId = new Map(allMembers.map(m => [String(m.id), m]))
    for (const c of myClubs) {
      const clubMembers = getClubMembersFromStorage(c.id) || []
      clubMembers.forEach(m => { if (m?.id) byId.set(String(m.id), m) })
    }

    for (const c of myClubs) {
      try {
        const ids = await bookingApi.getFavoriteMembers(member.id, c.id)
        favs[c.id] = Array.isArray(ids) ? ids : []
        favs[c.id].forEach(id => {
          const m = byId.get(String(id)) || allMembers.find(x => String(x.id) === String(id))
          if (m) byId.set(String(id), m)
        })
      } catch (_) {
        favs[c.id] = []
      }
    }
    setFavoritesByClub(favs)
    setMemberDetailsById(Object.fromEntries(byId))
  }, [member?.id, selectedClubId])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  useEffect(() => {
    window.addEventListener('clubs-synced', loadFavorites)
    return () => window.removeEventListener('clubs-synced', loadFavorites)
  }, [loadFavorites])

  const club = selectedClubId ? getClubById(selectedClubId) : null
  const clubMembers = club ? (getClubMembersFromStorage(club.id) || []) : []
  const allPlatformMembers = getAllMembersFromStorage() || []
  const otherMembers = clubMembers.filter(m => String(m?.id) !== String(member?.id))
  const platformNotInClub = (allPlatformMembers || []).filter(
    m => m?.id && String(m.id) !== String(member?.id) && !otherMembers.some(c => String(c?.id) === String(m.id))
  )
  const searchableMembers = [...otherMembers, ...platformNotInClub]
  const searchDigits = phoneDigits(searchQuery)
  const hasFullPhone = searchDigits.length >= FULL_PHONE_MIN
  const filteredBySearch = hasFullPhone
    ? searchableMembers.filter(m => {
        const mPhone = phoneDigits(m?.mobile || m?.phone || '')
        return mPhone && mPhone.includes(searchDigits)
      })
    : []

  const favoriteIds = new Set((favoritesByClub[selectedClubId] || []).map(String))
  const toggleFavorite = async (memberId, isFavorite) => {
    if (!selectedClubId || !member?.id || !memberId) return
    setLoading(true)
    try {
      if (isFavorite) {
        await bookingApi.removeFavoriteMember(member.id, selectedClubId, memberId)
      } else {
        await bookingApi.addFavoriteMember(member.id, selectedClubId, memberId)
      }
      await loadFavorites()
    } catch (_) {}
    setLoading(false)
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

                <div className="my-favorites-add">
                  <p className="my-favorites-add-hint">
                    {t('Enter full phone number (9+ digits) to search and add', 'أدخل رقم الجوال كاملاً (9+ أرقام) للبحث والإضافة')}
                  </p>
                  <input
                    type="tel"
                    className="my-favorites-search"
                    placeholder={t('Search by phone (9+ digits)', 'البحث برقم الجوال (9+ أرقام)')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    inputMode="tel"
                  />
                  {filteredBySearch.length > 0 ? (
                    <ul className="my-favorites-search-results">
                      {filteredBySearch.map(m => {
                        const isFav = favoriteIds.has(String(m.id))
                        return (
                          <li key={m.id} className="my-favorites-search-item">
                            <span>{m.name || m.email || m.id}</span>
                            <button
                              type="button"
                              className={`my-favorites-star ${isFav ? 'is-favorite' : ''}`}
                              onClick={() => toggleFavorite(m.id, isFav)}
                              disabled={loading}
                              title={isFav ? t('Remove from favorites', 'إزالة من المفضلة') : t('Add to favorites', 'إضافة للمفضلة')}
                            >
                              {isFav ? '★' : '☆'}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="my-favorites-search-empty">
                      {hasFullPhone
                        ? t('No members found for this phone number', 'لا توجد نتائج لهذا الرقم')
                        : t('Enter 9+ digits to search', 'أدخل 9+ أرقام للبحث')}
                    </p>
                  )}
                </div>

                <div className="my-favorites-list">
                  <h3>{t('Current favorites', 'المفضلة الحالية')}</h3>
                  {(favoritesByClub[selectedClubId] || []).length === 0 ? (
                    <p className="my-favorites-list-empty">{t('No favorites yet. Search above to add.', 'لا توجد مفضلة بعد. ابحث أعلاه للإضافة.')}</p>
                  ) : (
                    <ul className="my-favorites-list-items">
                      {(favoritesByClub[selectedClubId] || []).map(id => {
                        const m = memberDetailsById[String(id)]
                        return (
                          <li key={id} className="my-favorites-list-item">
                            <span>{m ? (m.name || m.email || id) : id}</span>
                            <button
                              type="button"
                              className="my-favorites-remove"
                              onClick={() => toggleFavorite(id, true)}
                              disabled={loading}
                              title={t('Remove from favorites', 'إزالة من المفضلة')}
                            >
                              ×
                            </button>
                          </li>
                        )
                      })}
                    </ul>
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
