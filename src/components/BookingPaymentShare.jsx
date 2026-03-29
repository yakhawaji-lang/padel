/**
 * Payment sharing for court bookings.
 * - Add registered club members
 * - Add unregistered users via contact picker or manual phone, generate WhatsApp invite link
 * - Split: equal or custom amounts (must not exceed total price)
 * - Favorites: show favorite members first, add/remove from favorites
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react'
import * as bookingApi from '../api/dbClient'
import { normalizePhone } from '../utils/phoneNormalize'
import { phoneTailKey, resolvePaymentShareDisplayName } from '../utils/paymentShareMemberMatch'
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

/**
 * splitPhase `participants` (club booking): add everyone first; `amounts`: split money + WhatsApp. Default `amounts` for training join.
 */
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
  splitPhase = 'amounts',
}) {
  const shares = value || []
  const isGatherPhase = splitPhase === 'participants'
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
  const phoneTailAlreadyInShares = useCallback(
    (tail) => {
      if (!tail || tail.length < 8) return false
      return (shares || []).some((s) => {
        const st = phoneTailKey(s.phone || '')
        if (st.length >= 8 && st === tail) return true
        if (s.memberId) {
          const m = searchableMembers.find((x) => String(x?.id) === String(s.memberId))
          const mt = phoneTailKey(m?.mobile || m?.phone || '')
          if (mt.length >= 8 && mt === tail) return true
        }
        return false
      })
    },
    [shares, searchableMembers]
  )
  const searchTail = phoneTailKey(memberSearchQuery)
  const FULL_PHONE_MIN = 9
  /** Enough digits for a confident match (national 9 or longer intl / local). */
  const hasFullPhone = searchTail.length >= FULL_PHONE_MIN
  const filteredBySearch = hasFullPhone
    ? searchableMembers.filter((m) => {
        if (!isGatherPhase && addedMemberIds.has(String(m?.id))) return false
        const mTail = phoneTailKey(m?.mobile || m?.phone || '')
        if (mTail.length < FULL_PHONE_MIN || searchTail.length < FULL_PHONE_MIN) return false
        return mTail === searchTail
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

  const previewShareForGather = useMemo(() => {
    const n = (shares?.length || 0) + 2
    return Math.round(((parseFloat(totalPrice) || 0) / n) * 100) / 100
  }, [totalPrice, shares.length])

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
    if (isGatherPhase) return
    if (splitMode === 'equal' && shares.length > 0) {
      const amt = Math.round((totalPrice / (shares.length + 1)) * 100) / 100
      const needsUpdate = shares.some(s => Math.abs((s.amount || 0) - amt) > 0.01)
      if (needsUpdate) {
        onChange(
          shares.map((s) => {
            const next = { ...s, amount: amt }
            if (s.type === 'registered') {
              const phone =
                s.phone ||
                searchableMembers.find((x) => String(x?.id) === String(s.memberId))?.mobile ||
                searchableMembers.find((x) => String(x?.id) === String(s.memberId))?.phone ||
                ''
              next.whatsappLink =
                buildWhatsAppLinkForRegistered(phone, clubName, dateStr, startTime, amt, currency, language) || undefined
            } else if (s.phone) {
              next.whatsappLink = buildWhatsAppLink(s.phone, clubName, dateStr, startTime, amt, currency, clubId)
            }
            return next
          })
        )
      }
    }
  }, [splitMode, totalPrice, shares.length, splitPhase, clubName, dateStr, startTime, currency, language, clubId, searchableMembers])

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
    if (isGatherPhase && addedMemberIds.has(String(member.id))) {
      setContactError(t('This participant is already in the split.', 'هذا المشارك مضاف مسبقاً في المشاركة.'))
      return
    }
    const amt = splitMode === 'equal' ? (shares.length === 0 ? totalPrice / 2 : equalAmount) : remaining / 2
    const amount = isGatherPhase ? 0 : Math.round(amt * 100) / 100
    const waAmt = isGatherPhase ? previewShareForGather : amount
    const phone = member?.mobile || member?.phone || ''
    const whatsappLink = buildWhatsAppLinkForRegistered(phone, clubName, dateStr, startTime, waAmt, currency, language)
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
    if (!isGatherPhase) setAddFormOpen(false)
  }

  const addUnregistered = (phoneVal) => {
    if (maxShareCount != null && shares.length >= maxShareCount) return
    const p = normalizePhone(phoneVal || memberSearchQuery)
    if (!p || p.length < 8) {
      setContactError(t('Enter a valid phone number', 'أدخل رقم جوال صحيح'))
      return
    }
    const tail = phoneTailKey(p)
    if (isGatherPhase && phoneTailAlreadyInShares(tail)) {
      setContactError(t('This participant is already in the split.', 'هذا المشارك مضاف مسبقاً في المشاركة.'))
      return
    }
    setContactError('')
    const amt = splitMode === 'equal' ? (shares.length === 0 ? totalPrice / 2 : equalAmount) : remaining / 2
    const amount = isGatherPhase ? 0 : Math.round(amt * 100) / 100
    const waAmt = isGatherPhase ? previewShareForGather : amount
    onChange([...shares, {
      phone: p,
      type: 'unregistered',
      amount,
      whatsappLink: buildWhatsAppLink(p, clubName, dateStr, startTime, waAmt, currency, clubId)
    }])
    setMemberSearchQuery('')
    if (!isGatherPhase) setAddFormOpen(false)
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

  const pickFromContacts = async () => {
    await fillSearchFromContacts()
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
          {isGatherPhase ? (
            <>
              <div className="booking-payment-share-gather-intro">
                <h4 className="booking-payment-share-gather-title">{t('Add participants', 'إضافة المشاركين')}</h4>
                <p className="booking-payment-share-gather-hint">
                  {t(
                    'Add everyone who will share this booking. Type a number or pick one contact at a time — the name appears when matched. Then continue to split amounts.',
                    'أضف كل من سيشارك في هذا الحجز. اكتب الرقم أو اختر جهة اتصال واحدة في المرة — يظهر الاسم عند المطابقة. ثم تابع إلى تقسيم المبالغ.'
                  )}
                </p>
              </div>

              {shares.length > 0 ? (
                <ul className="booking-payment-share-gather-list" role="list">
                  {shares.map((s, idx) => {
                    const resolvedLabel = resolvePaymentShareDisplayName(s, searchableMembers)
                    const rowLabel = resolvedLabel === '—' ? (s.phone || t('Unregistered', 'غير مسجل')) : resolvedLabel
                    return (
                      <li key={idx} className="booking-payment-share-gather-item">
                        <span className="booking-payment-share-gather-item-name">{rowLabel}</span>
                        {s.phone ? <span className="booking-payment-share-gather-item-phone">{normalizePhone(s.phone)}</span> : null}
                        <button type="button" className="booking-payment-share-remove" onClick={() => removeShare(idx)} aria-label={t('Remove', 'إزالة')}>
                          ×
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}

              {otherMembers.some((m) => favoriteIds.has(String(m.id)) && !addedMemberIds.has(String(m.id))) ? (
                <div className="booking-payment-share-favorites-pick">
                  <p className="booking-payment-share-favorites-pick-label">{t('From favorites', 'من المفضلة')}</p>
                  <ul className="booking-payment-share-favorites-pick-list" role="list">
                    {otherMembers
                      .filter((m) => favoriteIds.has(String(m.id)) && !addedMemberIds.has(String(m.id)))
                      .map((m) => (
                        <li key={m.id} className="booking-payment-share-favorites-pick-row">
                          <span className="booking-payment-share-favorites-pick-name">{m.name || m.email || m.id}</span>
                          <button
                            type="button"
                            className="booking-payment-share-unified-add-btn booking-payment-share-unified-add-btn--compact"
                            disabled={atShareCap}
                            onClick={() => addRegistered(m)}
                          >
                            {t('Add to split', 'إضافة للمشاركة')}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              {atShareCap ? (
                <p className="booking-payment-share-cap-notice" role="status">
                  {maxShareHint || t('Maximum number of participants for this split has been reached.', 'تم الوصول للحد الأقصى من المشاركين في التقسيم لهذه الحصة.')}
                </p>
              ) : null}

              {!atShareCap ? (
                <div className="booking-payment-share-add booking-payment-share-add--gather">
                  <p className="booking-payment-share-add-title">{t('Add participant', 'إضافة مشارك')}</p>
                  <p className="booking-payment-share-unified-hint">
                    {t(
                      'Same flow for typed numbers and contacts: pick one number, confirm the name, then tap Add.',
                      'نفس الخطوة للرقم المكتوب أو المختار من جهات الاتصال: رقم واحد، تأكيد الاسم، ثم إضافة للمشاركة.'
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
                          const m0 = filteredBySearch[0]
                          if (addedMemberIds.has(String(m0.id))) {
                            setContactError(t('This participant is already in the split.', 'هذا المشارك مضاف مسبقاً في المشاركة.'))
                            return
                          }
                          addRegistered(m0)
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
                          const waAmt = previewShareForGather
                          const waLink = buildWhatsAppLinkForRegistered(phone, clubName, dateStr, startTime, waAmt, currency, language)
                          const isFav = favoriteIds.has(String(m.id))
                          const already = addedMemberIds.has(String(m.id))
                          return (
                            <li key={m.id} className={`booking-payment-share-unified-match${already ? ' booking-payment-share-unified-match--already' : ''}`}>
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
                                {already ? (
                                  <p className="booking-payment-share-already-msg" role="status">
                                    {t('This participant is already in the split.', 'هذا المشارك مضاف مسبقاً في المشاركة.')}
                                  </p>
                                ) : (
                                  <>
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
                                  </>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    ) : phoneTailAlreadyInShares(searchTail) ? (
                      <div className="booking-payment-share-unified-match booking-payment-share-unified-match--already booking-payment-share-unified-match--guest">
                        <div className="booking-payment-share-unified-match-info">
                          <span className="booking-payment-share-unified-match-name">{normalizePhone(memberSearchQuery)}</span>
                        </div>
                        <p className="booking-payment-share-already-msg" role="status">
                          {t('This participant is already in the split.', 'هذا المشارك مضاف مسبقاً في المشاركة.')}
                        </p>
                      </div>
                    ) : (
                      <div className="booking-payment-share-unified-match booking-payment-share-unified-match--guest">
                        <div className="booking-payment-share-unified-match-info">
                          <span className="booking-payment-share-unified-match-name">{t('Not on PlayTix yet', 'غير مسجّل في المنصة')}</span>
                          <span className="booking-payment-share-unified-match-phone">{normalizePhone(memberSearchQuery)}</span>
                        </div>
                        <div className="booking-payment-share-unified-match-actions">
                          <a
                            href={buildWhatsAppLink(
                              normalizePhone(memberSearchQuery),
                              clubName,
                              dateStr,
                              startTime,
                              previewShareForGather,
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
                </div>
              ) : null}
            </>
          ) : (
            <>
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
                    {shares.map((s, idx) => {
                      const resolvedLabel = resolvePaymentShareDisplayName(s, searchableMembers)
                      const rowLabel = resolvedLabel === '—' ? (s.phone || t('Unregistered', 'غير مسجل')) : resolvedLabel
                      return (
                        <li key={idx} className="booking-payment-share-item">
                          <span className="booking-payment-share-item-label">
                            {rowLabel}
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
                      )
                    })}
                  </ul>

                  {totalShared > totalPrice && (
                    <p className="booking-payment-share-error" role="alert">
                      {t('Total shared amount cannot exceed booking price', 'مجموع المبالغ المشاركة لا يمكن أن يتجاوز سعر الحجز')}
                    </p>
                  )}

                  <p className="booking-payment-share-remaining">
                    {t('Your share', 'حصتك')}: <strong>{remaining.toFixed(2)} {currency}</strong>
                  </p>
                  <p className="booking-payment-share-back-add-hint">
                    {t('Need to add or remove someone? Use Back to return to participants.', 'لإضافة أو إزالة أحد استخدم «رجوع» للعودة إلى خطوة المشاركين.')}
                  </p>
                </>
              ) : (
                <p className="booking-payment-share-empty booking-payment-share-empty--unified" role="status">
                  {t('Add participants in the previous step first.', 'أضف المشاركين في الخطوة السابقة أولاً.')}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
