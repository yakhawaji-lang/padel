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
      if (String(s.memberId || s.member_id || '') === mid) return true
      if (mPhone.length >= 8 && phoneTailKey(s.phone || '') === mPhone) return true
      return false
    }) || null
  )
}

/** Non-tournament court/training booking: booker or split participant */
export function memberRelatesToCourtBooking(booking, member) {
  if (!member?.id || !booking || booking.isTournament) return false
  const memberIdStr = String(member.id)
  const isInitiator = String(booking.memberId || booking.initiatorMemberId || booking.member_id || '') === memberIdStr
  if (isInitiator) return true
  return !!findPaymentShareForMember(booking, member)
}
