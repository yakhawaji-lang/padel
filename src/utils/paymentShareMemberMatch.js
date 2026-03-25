/** Last 9 digits — match 05xxxxxxxx with 9665xxxxxxxx */
export function phoneTailKey(s) {
  const d = (s || '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : d
}

/** Payment share row belonging to this member (by id or phone tail) */
export function findPaymentShareForMember(booking, member) {
  if (!member?.id || !Array.isArray(booking?.paymentShares)) return null
  const mid = String(member.id)
  const mPhone = phoneTailKey(member.phone || member.mobile || '')
  return (
    booking.paymentShares.find((s) => {
      if (s.removedAt || s.removed_at) return false
      if (String(s.memberId || s.member_id || '') === mid) return true
      if (mPhone.length >= 8 && phoneTailKey(s.phone || '') === mPhone) return true
      return false
    }) || null
  )
}

/** member_name في DB قد يكون فارغاً أو يشبه رقماً — نعرض اسم العضو من دليل الأعضاء إن وُجد memberId */
export function shareDisplayLooksLikePhone(str) {
  if (!str || typeof str !== 'string') return false
  const t = str.trim()
  if (!t) return false
  const d = t.replace(/\D/g, '')
  if (d.length < 9) return false
  if (/^\+[\d\s-]+$/.test(t)) return true
  if (/^[\d\s-]+$/.test(t)) return true
  return false
}

/**
 * @param {object} share — payment share من الحجز
 * @param {Array<{id:string,name?:string,nameAr?:string,mobile?:string,phone?:string}>} memberDirectory — أعضاء النادي و/أو المنصة
 */
export function resolvePaymentShareDisplayName(share, memberDirectory) {
  const list = Array.isArray(memberDirectory) ? memberDirectory : []
  const mid = share?.memberId ?? share?.member_id
  const ph = (share?.phone || '').trim()
  const mn = (share?.memberName || '').trim()

  const nameFromMemberId = () => {
    if (!mid) return ''
    const m = list.find((x) => String(x?.id) === String(mid))
    const n = m?.name || m?.nameAr
    return n && String(n).trim() ? String(n).trim() : ''
  }

  /** مطابقة آخر 9 أرقام — تغطي الحصة برقم دولي والعضو بصيغة 05... */
  const nameFromPhoneTail = () => {
    if (!ph) return ''
    const tail = phoneTailKey(ph)
    if (tail.length < 8) return ''
    const m = list.find((x) => {
      const xt = phoneTailKey(x?.mobile || x?.phone || '')
      return xt.length >= 8 && xt === tail
    })
    const n = m?.name || m?.nameAr
    return n && String(n).trim() ? String(n).trim() : ''
  }

  const byId = nameFromMemberId()
  if (byId) return byId

  if (mn && !shareDisplayLooksLikePhone(mn)) return mn

  const byPhone = nameFromPhoneTail()
  if (byPhone) return byPhone

  if (mn) return mn
  return ph || '—'
}

/** Non-tournament court/training booking: booker or split participant */
export function memberRelatesToCourtBooking(booking, member) {
  if (!member?.id || !booking || booking.isTournament) return false
  const memberIdStr = String(member.id)
  const isInitiator = String(booking.memberId || booking.initiatorMemberId || booking.member_id || '') === memberIdStr
  if (isInitiator) return true
  return !!findPaymentShareForMember(booking, member)
}
