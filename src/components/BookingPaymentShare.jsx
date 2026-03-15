/**
 * Payment sharing for court bookings.
 * - Add registered club members
 * - Add unregistered users via contact picker or manual phone, generate WhatsApp invite link
 * - Split: equal or custom amounts (must not exceed total price)
 * - Favorites: show favorite members first, add/remove from favorites
 */
import React, { useState, useCallback, useEffect } from 'react'
import * as bookingApi from '../api/dbClient'
import { getImageUrl } from '../api/dbClient'

const CONTACT_PICKER_SUPPORTED = typeof navigator !== 'undefined' && 'contacts' in navigator && typeof navigator.contacts?.select === 'function'

/** Normalize phone to E.164-like for WhatsApp */
function normalizePhone(s) {
  if (!s || typeof s !== 'string') return ''
  return s.replace(/\s/g, '').replace(/^00/, '+').replace(/^0/, '+966')
}

/** Base path of the app (e.g. /app) — same as Vite base / Router basename, no trailing slash */
function getAppBasePath() {
  if (typeof window === 'undefined') return ''
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || ''
  const path = base.replace(/\/$/, '') || ''
  return path
}

/** Build registration URL with club join and optional phone for pre-fill — works locally and on deployed domain */
function getRegisterUrl(clubId, phone) {
  if (!clubId) return ''
  if (typeof window === 'undefined') return ''
  const basePath = getAppBasePath()
  let url = window.location.origin + (basePath ? basePath + '/' : '') + 'register?join=' + encodeURIComponent(clubId)
  if (phone) {
    const digits = String(phone).replace(/\D/g, '')
    if (digits.length >= 8) url += '&phone=' + encodeURIComponent(digits)
  }
  return url
}

/** Build WhatsApp share link with registration URL (includes phone for pre-fill) — for unregistered */
function buildWhatsAppLink(phone, clubName, dateStr, timeStr, amount, currency, clubId) {
  const p = normalizePhone(phone)
  const num = p.replace(/\D/g, '')
  const base = num.startsWith('966') ? `966${num.slice(3)}` : num
  const registerUrl = getRegisterUrl(clubId, phone)
  const registerText = registerUrl
    ? `سجّل في PlayTix للمشاركة: ${registerUrl}`
    : 'سجّل في PlayTix للمشاركة'
  const text = encodeURIComponent(
    `مرحباً! أنا أشاركك في دفع حجز ملعب في ${clubName || 'النادي'}\nالتاريخ: ${dateStr}\nالوقت: ${timeStr}\nمبلغ مشاركتك: ${amount} ${currency}\n${registerText}`
  )
  return `https://wa.me/${base}?text=${text}`
}

/** Build WhatsApp link for registered members — payment share + my-bookings follow-up */
function buildWhatsAppLinkForRegistered(phone, clubName, dateStr, timeStr, amount, currency, language) {
  if (!phone || String(phone).replace(/\D/g, '').length < 8) return null
  const p = normalizePhone(phone)
  const num = p.replace(/\D/g, '')
  const base = num.startsWith('966') ? `966${num.slice(3)}` : num
  const basePath = getAppBasePath()
  const myBookingsUrl = typeof window !== 'undefined'
    ? window.location.origin + (basePath ? basePath + '/' : '') + 'my-bookings'
    : ''
  const msg = language === 'ar'
    ? `مرحباً! تمت إضافتك لمشاركة في دفع حجز ملعب في ${clubName || 'النادي'}\nالتاريخ: ${dateStr}\nالوقت: ${timeStr}\nمبلغ مشاركتك: ${amount} ${currency}\nادخل إلى حجوزاتي لاستكمال الدفع ومتابعة الحجز:\n${myBookingsUrl}`
    : `Hi! You've been added to a shared court booking at ${clubName || 'the club'}\nDate: ${dateStr}\nTime: ${timeStr}\nYour share: ${amount} ${currency}\nComplete payment and track your booking:\n${myBookingsUrl}`
  return `https://wa.me/${base}?text=${encodeURIComponent(msg)}`
}

/** Extract digits from phone for search */
function phoneDigits(s) {
  return (s || '').replace(/\D/g, '')
}

export default function BookingPaymentShare({
  totalPrice,
  currency,
  clubName,
  clubId,
  dateStr,
  startTime,
  clubMembers = [],
  allPlatformMembers = [],
  currentMemberId,
  language = 'en',
  value = [],
  onChange,
}) {
  const shares = value || []
  const [isExpanded, setIsExpanded] = useState(shares.length > 0)
  const [splitMode, setSplitMode] = useState('equal')
  const [addType, setAddType] = useState('registered')
  const [manualPhone, setManualPhone] = useState('')
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [customAmounts, setCustomAmounts] = useState({})
  const [contactError, setContactError] = useState('')
  const [favoriteIds, setFavoriteIds] = useState(new Set())
  const [favoritesLoading, setFavoritesLoading] = useState(false)

  const t = useCallback((en, ar) => (language === 'ar' ? ar : en), [language])

  useEffect(() => {
    if (!clubId || !currentMemberId) return
    setFavoritesLoading(true)
    bookingApi.getFavoriteMembers(currentMemberId, clubId)
      .then(ids => setFavoriteIds(new Set(Array.isArray(ids) ? ids.map(String) : [])))
      .catch(() => {})
      .finally(() => setFavoritesLoading(false))
  }, [clubId, currentMemberId])

  const toggleFavorite = useCallback(async (memberId, isFavorite) => {
    if (!clubId || !currentMemberId || !memberId) return
    try {
      if (isFavorite) {
        await bookingApi.removeFavoriteMember(currentMemberId, clubId, memberId)
        setFavoriteIds(prev => { const s = new Set(prev); s.delete(String(memberId)); return s })
      } else {
        await bookingApi.addFavoriteMember(currentMemberId, clubId, memberId)
        setFavoriteIds(prev => new Set([...prev, String(memberId)]))
      }
    } catch (_) {}
  }, [clubId, currentMemberId])

  const otherMembers = clubMembers.filter(m => String(m?.id) !== String(currentMemberId))
  const platformNotInClub = (allPlatformMembers || []).filter(
    m => m?.id && String(m.id) !== String(currentMemberId) && !otherMembers.some(c => String(c?.id) === String(m.id))
  )
  const searchableMembers = [...otherMembers, ...platformNotInClub]
  const addedMemberIds = new Set((shares || []).filter(s => s.memberId).map(s => String(s.memberId)))
  const searchDigits = phoneDigits(memberSearchQuery)
  const FULL_PHONE_MIN = 9
  const hasFullPhone = searchDigits.length >= FULL_PHONE_MIN
  const filteredBySearch = hasFullPhone
    ? searchableMembers.filter(m => {
        if (addedMemberIds.has(String(m?.id))) return false
        const mPhone = phoneDigits(m?.mobile || m?.phone || '')
        return mPhone && mPhone.includes(searchDigits)
      })
    : []
  const favoriteMembers = searchableMembers.filter(m =>
    favoriteIds.has(String(m?.id)) && !addedMemberIds.has(String(m?.id))
  )
  const favoritesFirst = [...filteredBySearch].sort((a, b) => {
    const aFav = favoriteIds.has(String(a?.id))
    const bFav = favoriteIds.has(String(b?.id))
    if (aFav && !bFav) return -1
    if (!aFav && bFav) return 1
    return 0
  })

  const totalShared = shares.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  const remaining = Math.max(0, totalPrice - totalShared)
  const equalAmount = shares.length > 0 ? Math.round((totalPrice / (shares.length + 1)) * 100) / 100 : 0

  useEffect(() => {
    if (shares.length > 0 && !isExpanded) setIsExpanded(true)
  }, [shares.length])

  useEffect(() => {
    if (splitMode === 'equal' && shares.length > 0) {
      const amt = Math.round((totalPrice / (shares.length + 1)) * 100) / 100
      const needsUpdate = shares.some(s => Math.abs((s.amount || 0) - amt) > 0.01)
      if (needsUpdate) onChange(shares.map(s => ({ ...s, amount: amt })))
    }
  }, [splitMode, totalPrice, shares.length])

  const handleToggle = (checked) => {
    setIsExpanded(checked)
    if (!checked) {
      onChange([])
      setContactError('')
      setManualPhone('')
    }
  }

  const updateShareAmount = (idx, amount) => {
    const next = [...shares]
    next[idx] = { ...next[idx], amount: parseFloat(amount) || 0 }
    onChange(next)
  }

  const addRegistered = (member) => {
    if (!member?.id) return
    const amt = splitMode === 'equal' ? (shares.length === 0 ? totalPrice / 2 : equalAmount) : remaining / 2
    const amount = Math.round(amt * 100) / 100
    const phone = member?.mobile || member?.phone || ''
    const whatsappLink = buildWhatsAppLinkForRegistered(phone, clubName, dateStr, startTime, amount, currency, language)
    onChange([...shares, {
      memberId: member.id,
      memberName: member.name || member.email,
      phone: phone || undefined,
      type: 'registered',
      amount,
      whatsappLink: whatsappLink || undefined
    }])
  }

  const addUnregistered = (phoneVal) => {
    const p = normalizePhone(phoneVal || manualPhone)
    if (!p || p.length < 8) {
      setContactError(t('Enter a valid phone number', 'أدخل رقم جوال صحيح'))
      return
    }
    setContactError('')
    const amt = splitMode === 'equal' ? (shares.length === 0 ? totalPrice / 2 : equalAmount) : remaining / 2
    const amount = Math.round(amt * 100) / 100
    onChange([...shares, {
      phone: p,
      type: 'unregistered',
      amount,
      whatsappLink: buildWhatsAppLink(p, clubName, dateStr, startTime, amount, currency, clubId)
    }])
    setManualPhone('')
  }

  const pickFromContacts = async () => {
    setContactError('')
    try {
      const contacts = await navigator.contacts.select(['tel', 'name'], { multiple: true })
      if (contacts?.length > 0) {
        const validPhones = contacts.map(c => (c.tel && c.tel[0]) || '').map(tel => normalizePhone(tel)).filter(p => p && p.length >= 8)
        if (validPhones.length > 0) {
          const totalParticipants = shares.length + validPhones.length + 1
          const amt = splitMode === 'equal'
            ? Math.round((totalPrice / totalParticipants) * 100) / 100
            : Math.round((remaining / validPhones.length) * 100) / 100
          const newShares = validPhones.map(p => ({
            phone: p,
            type: 'unregistered',
            amount: amt,
            whatsappLink: buildWhatsAppLink(p, clubName, dateStr, startTime, amt, currency, clubId)
          }))
          onChange([...shares, ...newShares])
        } else {
          setContactError(t('No valid phone in selected contacts', 'لا يوجد رقم صالح في جهات الاتصال المختارة'))
        }
      }
    } catch (e) {
      if (e.name === 'SecurityError' || e.message?.includes('gesture')) {
        setContactError(t('Please click the button again to select contacts', 'انقر الزر مرة أخرى لاختيار جهة اتصال'))
      } else {
        setContactError(t('Could not access contacts. Enter phone manually.', 'تعذر الوصول لجهات الاتصال. أدخل الرقم يدوياً.'))
      }
    }
  }

  const removeShare = (idx) => {
    onChange(shares.filter((_, i) => i !== idx))
  }

  return (
    <div className="booking-payment-share">
      <div className="booking-payment-share-header">
        <label className="booking-payment-share-toggle">
          <input
            type="checkbox"
            checked={isExpanded}
            onChange={e => handleToggle(e.target.checked)}
            aria-expanded={isExpanded}
          />
          <span className="booking-payment-share-toggle-text">{t('Share payment with others', 'مشاركة الدفع مع آخرين')}</span>
        </label>
      </div>

      {isExpanded && (
        <div className="booking-payment-share-panel">
          {shares.length > 0 ? (
            <>
              <div className="booking-payment-share-followup">
                <h4 className="booking-payment-share-followup-title">{t('Booking follow-up', 'متابعة الحجز')}</h4>
                <p className="booking-payment-share-followup-hint">{t('Send payment share link to each participant via WhatsApp', 'أرسل رابط المشاركة بالدفع لكل مشارك عبر واتساب')}</p>
              </div>
              <div className="booking-payment-share-mode">
                <label className="booking-payment-share-radio">
                  <input
                    type="radio"
                    name="splitMode"
                    checked={splitMode === 'equal'}
                    onChange={() => setSplitMode('equal')}
                  />
                  <span>{t('Split equally', 'تقسيم بالتساوي')}</span>
                </label>
                <label className="booking-payment-share-radio">
                  <input
                    type="radio"
                    name="splitMode"
                    checked={splitMode === 'custom'}
                    onChange={() => setSplitMode('custom')}
                  />
                  <span>{t('Custom amounts', 'مبالغ محددة')}</span>
                </label>
              </div>

              <ul className="booking-payment-share-list" role="list">
                {shares.map((s, idx) => (
                  <li key={idx} className="booking-payment-share-item">
                    <span className="booking-payment-share-item-label">
                      {s.type === 'registered' ? (s.memberName || s.memberId) : (s.phone || t('Unregistered', 'غير مسجل'))}
                    </span>
                    <div className="booking-payment-share-item-amount">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={splitMode === 'equal' ? equalAmount : (customAmounts[idx] ?? s.amount)}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0
                          setCustomAmounts(prev => ({ ...prev, [idx]: v }))
                          updateShareAmount(idx, v)
                        }}
                        disabled={splitMode === 'equal'}
                        aria-label={t('Amount', 'المبلغ')}
                      />
                      <span className="booking-payment-share-currency">{currency}</span>
                    </div>
                    {s.whatsappLink ? (
                      <a href={s.whatsappLink} target="_blank" rel="noopener noreferrer" className="booking-payment-share-whatsapp" title={t('Send via WhatsApp', 'إرسال عبر واتساب')} aria-label="WhatsApp">
                        <span className="booking-payment-share-wa-icon">💬</span>
                        <span className="booking-payment-share-wa-label">{t('Send', 'إرسال')}</span>
                      </a>
                    ) : s.type === 'registered' ? (
                      <span className="booking-payment-share-no-phone" title={t('No phone number to send', 'لا يوجد رقم لإرسال الرابط')}>—</span>
                    ) : null}
                    <button type="button" className="booking-payment-share-remove" onClick={() => removeShare(idx)} aria-label={t('Remove', 'إزالة')}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              {totalShared > totalPrice && (
                <p className="booking-payment-share-error" role="alert">
                  {t('Total shared amount cannot exceed booking price', 'مجموع المبالغ المشاركة لا يمكن أن يتجاوز سعر الحجز')}
                </p>
              )}

              <p className="booking-payment-share-remaining">
                {t('Your share', 'حصتك')}: <strong>{remaining.toFixed(2)} {currency}</strong>
              </p>
            </>
          ) : null}

          <div className="booking-payment-share-add">
            <p className="booking-payment-share-add-title">{t('Add participant', 'إضافة مشارك')}</p>
            <div className="booking-payment-share-add-type">
              <label className="booking-payment-share-radio">
                <input type="radio" name="addType" checked={addType === 'registered'} onChange={() => setAddType('registered')} />
                <span>{t('Registered member', 'عضو مسجل')}</span>
              </label>
              <label className="booking-payment-share-radio">
                <input type="radio" name="addType" checked={addType === 'unregistered'} onChange={() => setAddType('unregistered')} />
                <span>{t('Not on platform', 'غير مسجل')}</span>
              </label>
            </div>

            {addType === 'registered' && (
              <div className="booking-payment-share-members">
                {favoriteMembers.length > 0 && (
                  <div className="booking-payment-share-favorites-section">
                    <p className="booking-payment-share-favorites-title">
                      ★ {t('My favorites', 'المفضلة')}
                    </p>
                    <div className="booking-payment-share-favorites-grid">
                      {favoriteMembers.map(m => {
                        const isAdded = shares.some(s => s.memberId === m.id)
                        return (
                          <button
                            key={m.id}
                            type="button"
                            className={`booking-payment-share-favorite-card ${isAdded ? 'is-added' : ''}`}
                            onClick={() => addRegistered(m)}
                            disabled={isAdded}
                          >
                            <span className="booking-payment-share-favorite-avatar">
                              {m.avatar ? (
                                <img src={getImageUrl(m.avatar)} alt="" />
                              ) : (
                                <span className="booking-payment-share-favorite-initial">{(m.name || m.email || '?')[0].toUpperCase()}</span>
                              )}
                            </span>
                            <span className="booking-payment-share-favorite-name">{m.name || m.email || m.id}</span>
                            {!favoritesLoading && (
                              <button
                                type="button"
                                className={`booking-payment-share-favorite-star ${favoriteIds.has(String(m.id)) ? 'is-favorite' : ''}`}
                                onClick={e => { e.stopPropagation(); toggleFavorite(m.id, true) }}
                                title={t('Remove from favorites', 'إزالة من المفضلة')}
                                aria-label={t('Remove from favorites', 'إزالة من المفضلة')}
                              >
                                ★
                              </button>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <p className="booking-payment-share-search-label">
                  {favoriteMembers.length > 0 ? t('Or search by phone', 'أو ابحث برقم الجوال') : t('Search by phone', 'البحث برقم الجوال')}
                </p>
                <input
                  type="tel"
                  className="booking-payment-share-search"
                  placeholder={t('Search by phone (9+ digits)', 'البحث برقم الجوال (9+ أرقام)')}
                  value={memberSearchQuery}
                  onChange={e => setMemberSearchQuery(e.target.value)}
                  inputMode="tel"
                />
                {favoritesFirst.length > 0 ? (
                  favoritesFirst.map(m => {
                    const isFavorite = favoriteIds.has(String(m.id))
                    const isAdded = shares.some(s => s.memberId === m.id)
                    return (
                      <div key={m.id} className="booking-payment-share-member-row">
                        <button
                          type="button"
                          className={`booking-payment-share-member-btn ${isFavorite ? 'is-favorite' : ''}`}
                          onClick={() => addRegistered(m)}
                          disabled={isAdded}
                        >
                          {m.name || m.email || m.id}
                        </button>
                        {!favoritesLoading && (
                          <button
                            type="button"
                            className={`booking-payment-share-favorite-btn ${isFavorite ? 'is-favorite' : ''}`}
                            onClick={e => { e.preventDefault(); toggleFavorite(m.id, isFavorite) }}
                            title={isFavorite ? t('Remove from favorites', 'إزالة من المفضلة') : t('Add to favorites', 'إضافة للمفضلة')}
                            aria-label={isFavorite ? t('Remove from favorites', 'إزالة من المفضلة') : t('Add to favorites', 'إضافة للمفضلة')}
                          >
                            {isFavorite ? '★' : '☆'}
                          </button>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <p className="booking-payment-share-empty">
                    {hasFullPhone
                      ? t('No members found for this phone number', 'لا توجد نتائج لهذا الرقم')
                      : t('Enter full phone number (9+ digits) to search — names shown only after match for privacy', 'أدخل رقم الجوال كاملاً (9+ أرقام) للبحث — الأسماء تظهر بعد المطابقة فقط للخصوصية')}
                  </p>
                )}
              </div>
            )}

            {addType === 'unregistered' && (
              <div className="booking-payment-share-phone">
                <p className="booking-payment-share-phone-hint">{t('Enter phone number to send WhatsApp link for registration, club join, and payment share', 'أدخل رقم الجوال لإرسال رابط واتساب للتسجيل في النادي والمنصة والمشاركة بالدفع')}</p>
                {CONTACT_PICKER_SUPPORTED && (
                  <button type="button" className="booking-payment-share-contact-btn" onClick={pickFromContacts}>
                    {t('Select from contacts', 'اختر من جهات الاتصال')}
                  </button>
                )}
                <div className="booking-payment-share-phone-row">
                  <input
                    type="tel"
                    placeholder={t('Enter phone number', 'أدخل رقم الجوال')}
                    value={manualPhone}
                    onChange={e => { setManualPhone(e.target.value); setContactError('') }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUnregistered())}
                    inputMode="tel"
                  />
                  <button type="button" className="booking-payment-share-add-phone" onClick={() => addUnregistered()}>
                    {t('Add', 'إضافة')}
                  </button>
                </div>
                {contactError && <p className="booking-payment-share-error" role="alert">{contactError}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
