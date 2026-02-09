/**
 * Payment sharing for court bookings.
 * - Add registered club members
 * - Add unregistered users via contact picker or manual phone, generate WhatsApp invite link
 * - Split: equal or custom amounts (must not exceed total price)
 */
import React, { useState, useCallback, useEffect } from 'react'

const CONTACT_PICKER_SUPPORTED = typeof navigator !== 'undefined' && 'contacts' in navigator && typeof navigator.contacts?.select === 'function'

/** Normalize phone to E.164-like for WhatsApp */
function normalizePhone(s) {
  if (!s || typeof s !== 'string') return ''
  return s.replace(/\s/g, '').replace(/^00/, '+').replace(/^0/, '+966')
}

/** Build WhatsApp share link */
function buildWhatsAppLink(phone, clubName, dateStr, timeStr, amount, currency) {
  const p = normalizePhone(phone)
  const num = p.replace(/\D/g, '')
  const base = num.startsWith('966') ? `966${num.slice(3)}` : num
  const text = encodeURIComponent(
    `مرحباً! أنا أشاركك في دفع حجز ملعب في ${clubName || 'النادي'}\nالتاريخ: ${dateStr}\nالوقت: ${timeStr}\nمبلغ مشاركتك: ${amount} ${currency}\nسجّل في PlayTix للمشاركة: `
  )
  return `https://wa.me/${base}?text=${text}`
}

export default function BookingPaymentShare({
  totalPrice,
  currency,
  clubName,
  dateStr,
  startTime,
  clubMembers = [],
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
  const [customAmounts, setCustomAmounts] = useState({})
  const [contactError, setContactError] = useState('')

  const t = useCallback((en, ar) => (language === 'ar' ? ar : en), [language])

  const otherMembers = clubMembers.filter(m => String(m?.id) !== String(currentMemberId))

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
    onChange([...shares, { memberId: member.id, memberName: member.name || member.email, type: 'registered', amount: Math.round(amt * 100) / 100 }])
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
      whatsappLink: buildWhatsAppLink(p, clubName, dateStr, startTime, amount, currency)
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
            whatsappLink: buildWhatsAppLink(p, clubName, dateStr, startTime, amt, currency)
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
                    {s.whatsappLink && (
                      <a href={s.whatsappLink} target="_blank" rel="noopener noreferrer" className="booking-payment-share-whatsapp" title="Send WhatsApp" aria-label="WhatsApp">
                        <span className="booking-payment-share-wa-icon">💬</span>
                      </a>
                    )}
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
                {otherMembers.length > 0 ? (
                  otherMembers.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className="booking-payment-share-member-btn"
                      onClick={() => addRegistered(m)}
                      disabled={shares.some(s => s.memberId === m.id)}
                    >
                      {m.name || m.email || m.id}
                    </button>
                  ))
                ) : (
                  <p className="booking-payment-share-empty">{t('No other members in club', 'لا يوجد أعضاء آخرين في النادي')}</p>
                )}
              </div>
            )}

            {addType === 'unregistered' && (
              <div className="booking-payment-share-phone">
                {CONTACT_PICKER_SUPPORTED && (
                  <button type="button" className="booking-payment-share-contact-btn" onClick={pickFromContacts}>
                    {t('Select from contacts', 'اختر من جهات الاتصال')}
                  </button>
                )}
                <div className="booking-payment-share-phone-row">
                  <input
                    type="tel"
                    placeholder={t('Or enter phone number', 'أو أدخل رقم الجوال')}
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
