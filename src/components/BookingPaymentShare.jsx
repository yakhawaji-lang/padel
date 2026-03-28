/**
 * Payment sharing for court bookings.
 * - Add registered club members
 * - Add unregistered users via contact picker or manual phone, generate WhatsApp invite link
 * - Split: equal or custom amounts (must not exceed total price)
 * - Favorites: show favorite members first, add/remove from favorites
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import * as bookingApi from '../api/dbClient'
import { normalizePhone, phoneDigits } from '../utils/phoneNormalize'
import { isContactsPickSupported, pickPhoneNumbersFromContacts } from '../utils/contactPicker'

export { normalizePhone } from '../utils/phoneNormalize'

/** Base path of the app (e.g. /app) — same as Vite base / Router basename, no trailing slash */
export function getAppBasePath() {
  if (typeof window === 'undefined') return ''
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || ''
  const path = base.replace(/\/$/, '') || ''
  return path
}

/** Build registration URL with club join and optional phone for pre-fill — works locally and on deployed domain */
export function getRegisterUrl(clubId, phone) {
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
export function buildWhatsAppLink(phone, clubName, dateStr, timeStr, amount, currency, clubId) {
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
export function buildWhatsAppLinkForRegistered(phone, clubName, dateStr, timeStr, amount, currency, language) {
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
  /** Max number of other payers (excludes booker). Null = no limit. */
  maxShareCount = null,
  /** Hide outer "Share payment" checkbox; panel always open (e.g. training join step). */
  hideHeaderToggle = false,
  /** Optional hint when cap reached */
  maxShareHint = '',
}) {
  const shares = value || []
  const [isExpanded, setIsExpanded] = useState(hideHeaderToggle || shares.length > 0)
  const [splitMode, setSplitMode] = useState('equal')
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  /** When false, only the "Add participant" header + [+] are shown (after at least one share exists). */
  const [addFormOpen, setAddFormOpen] = useState(true)
  const [customAmounts, setCustomAmounts] = useState({})
  const [contactError, setContactError] = useState('')
  const [contactsBusy, setContactsBusy] = useState(false)
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

  const nextShareAmount = useMemo(() => {
    const raw =
      splitMode === 'equal'
        ? shares.length === 0
          ? totalPrice / 2
          : equalAmount
        : remaining / 2
    return Math.round((parseFloat(raw) || 0) * 100) / 100
  }, [splitMode, shares.length, totalPrice, equalAmount, remaining])

  useEffect(() => {
    if (shares.length === 0) setAddFormOpen(true)
  }, [shares.length])

  useEffect(() => {
    if (hideHeaderToggle) setIsExpanded(true)
  }, [hideHeaderToggle])

  useEffect(() => {
    if (shares.length > 0 && !isExpanded) setIsExpanded(true)
  }, [shares.length, isExpanded])

  const atShareCap = maxShareCount != null && shares.length >= maxShareCount

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
      setMemberSearchQuery('')
      setAddFormOpen(true)
    }
  }

  const updateShareAmount = (idx, amount) => {
    const next = [...shares]
    next[idx] = { ...next[idx], amount: parseFloat(amount) || 0 }
    onChange(next)
  }

  const addRegistered = (member) => {
    if (!member?.id) return
    if (maxShareCount != null && shares.length >= maxShareCount) return
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
    setMemberSearchQuery('')
    setContactError('')
    setAddFormOpen(false)
  }

  const addUnregistered = (phoneVal) => {
    if (maxShareCount != null && shares.length >= maxShareCount) return
    const p = normalizePhone(phoneVal || memberSearchQuery)
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
    setMemberSearchQuery('')
    setAddFormOpen(false)
  }

  const pickFromContacts = async () => {
    setContactError('')
    setContactsBusy(true)
    try {
      const room = maxShareCount != null ? Math.max(0, maxShareCount - shares.length) : 20
      const { phones: validPhonesRaw, error } = await pickPhoneNumbersFromContacts({ multiple: true, max: room })
      if (error === 'USER_CANCELLED') return
      if (error === 'PERMISSION_DENIED') {
        setContactError(t('Allow contacts access in settings to pick numbers', 'اسمح بالوصول لجهات الاتصال من إعدادات الجهاز أو التطبيق'))
        return
      }
      if (error === 'NOT_SUPPORTED') {
        setContactError(t('Contacts are not available in this browser. Type the number or use keyboard suggestions.', 'جهات الاتصال غير متاحة في هذا المتصفح. أدخل الرقم يدوياً أو من اقتراحات لوحة المفاتيح.'))
        return
      }
      let validPhones = validPhonesRaw.filter(p => phoneDigits(p).length >= 8)
      if (maxShareCount != null) validPhones = validPhones.slice(0, room)
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
        setAddFormOpen(false)
      } else if (error === 'NATIVE_PICK_FAILED' || error === 'WEB_PICK_FAILED') {
        setContactError(t('Could not read contacts. Try again or enter the number manually.', 'تعذر قراءة جهات الاتصال. أعد المحاولة أو أدخل الرقم يدوياً.'))
      } else {
        setContactError(t('No valid phone in selected contacts', 'لا يوجد رقم صالح في جهات الاتصال المختارة'))
      }
    } catch (e) {
      if (e?.name === 'SecurityError' || e?.message?.includes?.('gesture')) {
        setContactError(t('Please tap the button again to open contacts', 'انقر الزر مرة أخرى لفتح جهات الاتصال'))
      } else {
        setContactError(t('Could not access contacts. Enter phone manually.', 'تعذر الوصول لجهات الاتصال. أدخل الرقم يدوياً.'))
      }
    } finally {
      setContactsBusy(false)
    }
  }

  const fillSearchFromContacts = async () => {
    setContactError('')
    setContactsBusy(true)
    try {
      const { phones, error } = await pickPhoneNumbersFromContacts({ multiple: false, max: 1 })
      if (error === 'USER_CANCELLED') return
      if (error === 'PERMISSION_DENIED') {
        setContactError(t('Allow contacts access in settings to pick a number', 'اسمح بالوصول لجهات الاتصال من الإعدادات'))
        return
      }
      if (error === 'NOT_SUPPORTED') {
        setContactError(t('Contacts picker is not available here.', 'اختيار جهات الاتصال غير متوفر هنا.'))
        return
      }
      if (phones[0]) {
        setMemberSearchQuery(phones[0])
        return
      }
      if (error === 'NATIVE_PICK_FAILED' || error === 'WEB_PICK_FAILED') {
        setContactError(t('Could not read contacts.', 'تعذر قراءة جهات الاتصال.'))
      } else {
        setContactError(t('No valid phone in that contact', 'لا يوجد رقم صالح في جهة الاتصال'))
      }
    } finally {
      setContactsBusy(false)
    }
  }

  const removeShare = (idx) => {
    onChange(shares.filter((_, i) => i !== idx))
  }

  return (
    <div className="booking-payment-share">
      {!hideHeaderToggle && (
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
      )}

      {isExpanded && (
        <div className="booking-payment-share-panel">
          {shares.length > 0 ? (
            <>
              <div className="booking-payment-share-followup">
                <h4 className="booking-payment-share-followup-title">{t('Booking follow-up', 'متابعة الحجز')}</h4>
                <p className="booking-payment-share-followup-hint">{t('Send payment share link to each participant via WhatsApp', 'أرسل رابط المشاركة بالدفع لكل مشارك عبر واتساب')}</p>
                <p className="booking-payment-share-pending-invite-note">{t(
                  'After you confirm the booking, use the yellow banner on this page to send each guest their final personal link (with payment).',
                  'بعد تأكيد الحجز، استخدم الشريط الأصفر في الصفحة لإرسال الرابط الشخصي النهائي لكل ضيف (يتضمن الدفع).'
                )}</p>
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

          {atShareCap ? (
            <p className="booking-payment-share-cap-notice" role="status">
              {maxShareHint || t('Maximum number of participants for this split has been reached.', 'تم الوصول للحد الأقصى من المشاركين في التقسيم لهذه الحصة.')}
            </p>
          ) : null}

          {!atShareCap ? (
            <div className="booking-payment-share-add">
              <div className="booking-payment-share-add-header">
                <p className="booking-payment-share-add-title">{t('Add participant', 'إضافة مشارك')}</p>
                {shares.length > 0 ? (
                  <button
                    type="button"
                    className="booking-payment-share-add-expand-btn"
                    aria-expanded={addFormOpen}
                    onClick={() => setAddFormOpen((open) => !open)}
                    title={
                      addFormOpen
                        ? t('Hide add participant', 'إخفاء إضافة مشارك')
                        : t('Add another participant', 'إضافة مشارك آخر')
                    }
                  >
                    <span className="booking-payment-share-add-expand-icon" aria-hidden>{addFormOpen ? '−' : '+'}</span>
                  </button>
                ) : null}
              </div>

              {addFormOpen ? (
                <>
                  <p className="booking-payment-share-unified-hint">
                    {t(
                      'Enter the participant mobile number. If they are registered, their name appears — use the star for favorites and WhatsApp to send the booking. If not registered, use WhatsApp to invite them, then add them to the split to continue.',
                      'أدخل رقم جوال المشارك. إن وُجد كعضو مسجّل يظهر اسمه — استخدم النجمة للمفضلة وواتساب لإرسال الحجز. إن لم يكن مسجّلاً استخدم واتساب للدعوة، ثم أضفه للمشاركة لمتابعة الحجز.'
                    )}
                  </p>
                  <p className="booking-payment-share-search-label">{t('Participant mobile number', 'رقم جوال المشارك')}</p>
                  <div className="booking-payment-share-search-row">
                    <input
                      type="tel"
                      className="booking-payment-share-search"
                      placeholder={t('Search by phone (9+ digits)', 'البحث برقم الجوال (9+ أرقام)')}
                      value={memberSearchQuery}
                      onChange={(e) => {
                        setMemberSearchQuery(e.target.value)
                        setContactError('')
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        if (atShareCap || !hasFullPhone) return
                        if (filteredBySearch.length === 1) {
                          addRegistered(filteredBySearch[0])
                        } else if (filteredBySearch.length === 0) {
                          addUnregistered(memberSearchQuery)
                        }
                      }}
                      inputMode="tel"
                      autoComplete="tel"
                      enterKeyHint="search"
                    />
                    {isContactsPickSupported() ? (
                      <button
                        type="button"
                        className="booking-payment-share-contact-icon-btn"
                        onClick={fillSearchFromContacts}
                        disabled={atShareCap || contactsBusy}
                        title={t('Pick from contacts', 'اختر من جهات الاتصال')}
                        aria-label={t('Pick from contacts', 'اختر من جهات الاتصال')}
                      >
                        <span className="booking-payment-share-contact-icon" aria-hidden>📇</span>
                      </button>
                    ) : null}
                  </div>

                  {isContactsPickSupported() ? (
                    <button
                      type="button"
                      className="booking-payment-share-contact-btn booking-payment-share-contact-btn--block"
                      onClick={pickFromContacts}
                      disabled={atShareCap || contactsBusy}
                    >
                      {contactsBusy ? '…' : t('Select from contacts', 'اختر من جهات الاتصال')}
                    </button>
                  ) : null}

                  {hasFullPhone ? (
                    filteredBySearch.length > 0 ? (
                      <ul className="booking-payment-share-unified-match-list" role="list">
                        {favoritesFirst.map((m) => {
                          const phone = m?.mobile || m?.phone || ''
                          const waLink = buildWhatsAppLinkForRegistered(
                            phone,
                            clubName,
                            dateStr,
                            startTime,
                            nextShareAmount,
                            currency,
                            language
                          )
                          const isFav = favoriteIds.has(String(m.id))
                          return (
                            <li key={m.id} className="booking-payment-share-unified-match">
                              <div className="booking-payment-share-unified-match-info">
                                <span className="booking-payment-share-unified-match-name">{m.name || m.email || m.id}</span>
                                {!favoritesLoading ? (
                                  <button
                                    type="button"
                                    className={`booking-payment-share-unified-fav ${isFav ? 'is-favorite' : ''}`}
                                    onClick={() => toggleFavorite(m.id, isFav)}
                                    title={
                                      isFav
                                        ? t('Remove from favorites', 'إزالة من المفضلة')
                                        : t('Add to favorites', 'إضافة للمفضلة')
                                    }
                                    aria-label={
                                      isFav ? t('Remove from favorites', 'إزالة من المفضلة') : t('Add to favorites', 'إضافة للمفضلة')
                                    }
                                  >
                                    {isFav ? '★' : '☆'}
                                  </button>
                                ) : null}
                              </div>
                              <div className="booking-payment-share-unified-match-actions">
                                {waLink ? (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="booking-payment-share-whatsapp booking-payment-share-whatsapp--icon-only"
                                    title={t('Send via WhatsApp', 'إرسال عبر واتساب')}
                                    aria-label={t('WhatsApp', 'واتساب')}
                                  >
                                    <span className="booking-payment-share-wa-icon">💬</span>
                                  </a>
                                ) : (
                                  <span className="booking-payment-share-no-phone" title={t('No phone number to send', 'لا يوجد رقم لإرسال الرابط')}>
                                    —
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="booking-payment-share-unified-add-btn"
                                  onClick={() => addRegistered(m)}
                                  disabled={atShareCap}
                                >
                                  {t('Add to split', 'إضافة للمشاركة')}
                                </button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <div className="booking-payment-share-unified-match booking-payment-share-unified-match--guest">
                        <div className="booking-payment-share-unified-match-info">
                          <span className="booking-payment-share-unified-match-name">
                            {t('Not on PlayTix yet', 'غير مسجّل في المنصة')}
                          </span>
                          <span className="booking-payment-share-unified-match-phone">{normalizePhone(memberSearchQuery)}</span>
                        </div>
                        <div className="booking-payment-share-unified-match-actions">
                          <a
                            href={buildWhatsAppLink(
                              normalizePhone(memberSearchQuery),
                              clubName,
                              dateStr,
                              startTime,
                              nextShareAmount,
                              currency,
                              clubId
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="booking-payment-share-whatsapp booking-payment-share-whatsapp--icon-only"
                            title={t('Send invite via WhatsApp', 'إرسال الدعوة عبر واتساب')}
                            aria-label={t('WhatsApp', 'واتساب')}
                          >
                            <span className="booking-payment-share-wa-icon">💬</span>
                          </a>
                          <button
                            type="button"
                            className="booking-payment-share-unified-add-btn"
                            onClick={() => addUnregistered(memberSearchQuery)}
                            disabled={atShareCap}
                          >
                            {t('Add to split', 'إضافة للمشاركة')}
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <p className="booking-payment-share-empty booking-payment-share-empty--unified">
                      {t(
                        'Enter full phone number (9+ digits) to search — names shown only after match for privacy',
                        'أدخل رقم الجوال كاملاً (9+ أرقام) للبحث — الأسماء تظهر بعد المطابقة فقط للخصوصية'
                      )}
                    </p>
                  )}

                  {contactError ? (
                    <p className="booking-payment-share-error booking-payment-share-error--add-block" role="alert">
                      {contactError}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
