/** Last 9 digits — match 05xxxxxxxx with 9665xxxxxxxx */
export function phoneTailKey(s) {
  const d = (s || '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : d
}

/** Minimum tail length for confident Saudi-style mobile match (aligns with booking payment share search). */
const PHONE_TAIL_MATCH_MIN = 8

/**
 * Members in directory whose mobile/phone matches the given number by last 9 digits.
 * Multiple results = ambiguous (rare); caller should treat as guest unless length === 1.
 * @param {string} phone
 * @param {Array<{id?:string,mobile?:string,phone?:string}>} memberDirectory
 */
export function findMembersByPhoneTail(phone, memberDirectory) {
  const list = Array.isArray(memberDirectory) ? memberDirectory : []
  const tail = phoneTailKey(phone || '')
  if (tail.length < PHONE_TAIL_MATCH_MIN) return []
  return list.filter((x) => {
    const xt = phoneTailKey(x?.mobile || x?.phone || '')
    return xt.length >= PHONE_TAIL_MATCH_MIN && xt === tail
  })
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

/**
 * حصة تم استردادها وبانتظار تأكيد المشارك باستلام المبلغ (حتى لو أُزيل من التقسيم).
 */
export function shareNeedsRefundAcknowledgment(share, member) {
  if (!share?.refundedAt || share.refundAcknowledgedAt) return false
  if (!member?.id) return false
  if (String(share.memberId || share.member_id || '') === String(member.id)) return true
  const tail = (raw) => {
    const d = String(raw || '').replace(/\D/g, '')
    return d.length >= 9 ? d.slice(-9) : d
  }
  const mp = tail(member.phone || member.mobile || '')
  const sp = tail(share.phone || '')
  return mp.length >= 8 && sp.length >= 8 && mp === sp
}

/** Share was paid online/card — member may request reversal to card (club fulfills). */
export function sharePaymentAllowsElectronicRefund(share) {
  const pm = String(share?.paymentMethod || share?.payment_method || '')
    .toLowerCase()
    .trim()
  if (!pm || pm === 'at_club' || pm === 'pay_at_club' || pm === 'cash') return false
  return ['credit_card', 'mada', 'electronic', 'card', 'online', 'stripe', 'apple_pay', 'google_pay', 'tap', 'hyperpay'].includes(pm)
}

export function isSamePaymentShare(a, b) {
  if (!a || !b) return false
  if (a.id != null && b.id != null && String(a.id) === String(b.id)) return true
  if (a.inviteToken && b.inviteToken && a.inviteToken === b.inviteToken) return true
  return false
}

/** Non-tournament court/training booking: booker or split participant */
export function memberRelatesToCourtBooking(booking, member) {
  if (!member?.id || !booking || booking.isTournament) return false
  const memberIdStr = String(member.id)
  const isInitiator = String(booking.memberId || booking.initiatorMemberId || booking.member_id || '') === memberIdStr
  if (isInitiator) return true
  if (findPaymentShareForMember(booking, member)) return true
  const shares = booking.paymentShares || []
  return shares.some((s) => shareNeedsRefundAcknowledgment(s, member))
}
