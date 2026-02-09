/**
 * Payment sharing for court bookings.
 * - Add registered club members
 * - Add unregistered users via contact picker or manual phone, generate WhatsApp invite link
 * - Split: equal or custom amounts (must not exceed total price)
 */
import React, { useState, useCallback, useEffect } from 'react'

const CONTACT_PICKER_SUPPORTED = typeof navigator !== 'undefined' && 'contacts' in navigator && typeof navigator.contacts?.select === 'function'

/** Normalize phone to E.164-like for WhatsApp (remove spaces, keep + and digits) */
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
  const [splitMode, setSplitMode] = useState('equal') // 'equal' | 'custom'
  const [addType, setAddType] = useState('registered') // 'registered' | 'unregistered'
  const [manualPhone, setManualPhone] = useState('')
  const [customAmounts, setCustomAmounts] = useState({})
  const [contactError, setContactError] = useState('')

  const t = useCallback((en, ar) => (language === 'ar' ? ar : en), [language])

  const otherMembers = clubMembers.filter(m => String(m?.id) !== String(currentMemberId))

  const totalShared = shares.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  const remaining = Math.max(0, totalPrice - totalShared)
  const isValid = totalShared <= totalPrice && (shares.length === 0 || totalShared > 0)

  const equalAmount = shares.length > 0 ? Math.round((totalPrice / (shares.length + 1)) * 100) / 100 : 0

  useEffect(() => {
    if (splitMode === 'equal' && shares.length > 0) {
      const amt = Math.round((totalPrice / (shares.length + 1)) * 100) / 100
      const needsUpdate = shares.some(s => Math.abs((s.amount || 0) - amt) > 0.01)
      if (needsUpdate) onChange(shares.map(s => ({ ...s, amount: amt })))
    }
  }, [splitMode, totalPrice, shares.length])

  const updateShareAmount = (idx, amount) => {
    const next = [...shares]
    next[idx] = { ...next[idx], amount: parseFloat(amount) || 0 }
    onChange(next)
  }

  const addRegistered = (member) => {
    if (!member?.id) return
    const amt = splitMode === 'equal' ? equalAmount || totalPrice / 2 : remaining / 2
    onChange([...shares, { memberId: member.id, memberName: member.name || member.email, type: 'registered', amount: Math.round(amt * 100) / 100 }])
  }

  const addUnregistered = (phone, fromContacts = false) => {
    const p = normalizePhone(phone || manualPhone)
    if (!p || p.length < 8) {
      setContactError(t('Enter a valid phone number', 'أدخل رقم جوال صحيح'))
      return
    }
    setContactError('')
    const amt = splitMode === 'equal' ? equalAmount || totalPrice / 2 : remaining / 2
    onChange([...shares, {
      phone: p,
      type: 'unregistered',
      amount: Math.round(amt * 100) / 100,
      whatsappLink: buildWhatsAppLink(p, clubName, dateStr, startTime, Math.round(amt * 100) / 100, currency)
    }])
    setManualPhone('')
  }

  const pickFromContacts = async () => {
    setContactError('')
    try {
      const contacts = await navigator.contacts.select(['tel', 'name'], { multiple: true })
      if (contacts?.length > 0) {
        const first = contacts[0]
        const tel = (first.tel && first.tel[0]) || ''
        if (tel) addUnregistered(tel, true)
        else setContactError(t('No phone number in selected contact', 'لا يوجد رقم في جهة الاتصال المختارة'))
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
            checked={shares.length > 0}
            onChange={e => { if (!e.target.checked) onChange([]) }}
          />
          <span>{t('Share payment with others', 'مشاركة الدفع مع آخرين')}</span>
        </label>
      </div>

      {shares.length > 0 && (
        <>
          <div className="booking-payment-share-mode">
            <label>
              <input
                type="radio"
                name="splitMode"
                checked={splitMode === 'equal'}
                onChange={() => setSplitMode('equal')}
              />
              {t('Split equally', 'تقسيم بالتساوي')}
            </label>
            <label>
              <input
                type="radio"
                name="splitMode"
                checked={splitMode === 'custom'}
                onChange={() => setSplitMode('custom')}
              />
              {t('Custom amounts', 'مبالغ محددة')}
            </label>
          </div>

          <div className="booking-payment-share-list">
            {shares.map((s, idx) => (
              <div key={idx} className="booking-payment-share-item">
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
                  />
                  <span>{currency}</span>
                </div>
                {s.whatsappLink && (
                  <a href={s.whatsappLink} target="_blank" rel="noopener noreferrer" className="booking-payment-share-whatsapp" title="Send WhatsApp">
                    WhatsApp
                  </a>
                )}
                <button type="button" className="booking-payment-share-remove" onClick={() => removeShare(idx)} aria-label={t('Remove', 'إزالة')}>
                  ×
                </button>
              </div>
            ))}
          </div>

          {totalShared > totalPrice && (
            <p className="booking-payment-share-error">
              {t('Total shared amount cannot exceed booking price', 'مجموع المبالغ المشاركة لا يمكن أن يتجاوز سعر الحجز')}
            </p>
          )}

          <div className="booking-payment-share-add">
            <div className="booking-payment-share-add-type">
              <label><input type="radio" name="addType" checked={addType === 'registered'} onChange={() => setAddType('registered')} /> {t('Registered member', 'عضو مسجل')}</label>
              <label><input type="radio" name="addType" checked={addType === 'unregistered'} onChange={() => setAddType('unregistered')} /> {t('Not on platform', 'غير مسجل')}</label>
            </div>

            {addType === 'registered' && (
              <div className="booking-payment-share-members">
                {otherMembers.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    className="booking-payment-share-member-btn"
                    onClick={() => addRegistered(m)}
                    disabled={shares.some(s => s.memberId === m.id)}
                  >
                    {m.name || m.email || m.id}
                  </button>
                ))}
                {otherMembers.length === 0 && (
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
                <div className="booking-payment-share-phone-input">
                  <input
                    type="tel"
                    placeholder={t('Or enter phone number', 'أو أدخل رقم الجوال')}
                    value={manualPhone}
                    onChange={e => { setManualPhone(e.target.value); setContactError('') }}
                    onKeyDown={e => e.key === 'Enter' && addUnregistered()}
                  />
                  <button type="button" className="booking-payment-share-add-phone" onClick={() => addUnregistered()}>
                    {t('Add & create WhatsApp link', 'إضافة وإنشاء رابط واتساب')}
                  </button>
                </div>
                {contactError && <p className="booking-payment-share-error">{contactError}</p>}
              </div>
            )}
          </div>

          <p className="booking-payment-share-remaining">
            {t('Your share', 'حصتك')}: {remaining.toFixed(2)} {currency}
          </p>
        </>
      )}

      {shares.length === 0 && (
        <div className="booking-payment-share-add-inline">
          <div className="booking-payment-share-add-type">
            <label><input type="radio" name="addType" checked={addType === 'registered'} onChange={() => setAddType('registered')} /> {t('Registered member', 'عضو مسجل')}</label>
            <label><input type="radio" name="addType" checked={addType === 'unregistered'} onChange={() => setAddType('unregistered')} /> {t('Not on platform', 'غير مسجل')}</label>
          </div>
          {addType === 'registered' && otherMembers.length > 0 && (
            <div className="booking-payment-share-members">
              {otherMembers.slice(0, 5).map(m => (
                <button key={m.id} type="button" className="booking-payment-share-member-btn" onClick={() => addRegistered(m)}>
                  {m.name || m.email || m.id}
                </button>
              ))}
            </div>
          )}
          {addType === 'unregistered' && (
            <div className="booking-payment-share-phone">
              {CONTACT_PICKER_SUPPORTED && (
                <button type="button" className="booking-payment-share-contact-btn" onClick={pickFromContacts}>
                  {t('Select from contacts', 'اختر من جهات الاتصال')}
                </button>
              )}
              <input
                type="tel"
                placeholder={t('Phone number', 'رقم الجوال')}
                value={manualPhone}
                onChange={e => { setManualPhone(e.target.value); setContactError('') }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUnregistered())}
              />
              <button type="button" className="booking-payment-share-add-phone" onClick={() => addUnregistered()}>
                {t('Add & WhatsApp link', 'إضافة ورابط واتساب')}
              </button>
              {contactError && <p className="booking-payment-share-error">{contactError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
