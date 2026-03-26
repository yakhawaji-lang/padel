/**
 * دمج قنوات الدفع: المنصة (إعدادات رئيسية) + النادي (تفعيل/تعطيل لكل نادي).
 * القنوات الإلكترونية تتطلب تفعيل المنصة والنادي معاً. at_club و split: تعطيل النادي يكفي لإخفائها.
 */

const DEFAULT_PLATFORM = {
  at_club: true,
  wallet: false,
  credit_card: false,
  mada: false,
  split: true
}

export function getEffectivePaymentChannels(platformEnabledChannels, clubPaymentEnabledChannels) {
  const p = {
    at_club: platformEnabledChannels?.at_club !== false,
    wallet: !!platformEnabledChannels?.wallet,
    credit_card: !!platformEnabledChannels?.credit_card,
    mada: !!platformEnabledChannels?.mada,
    split: platformEnabledChannels?.split !== false
  }
  const c =
    clubPaymentEnabledChannels && typeof clubPaymentEnabledChannels === 'object' && !Array.isArray(clubPaymentEnabledChannels)
      ? clubPaymentEnabledChannels
      : null
  if (!c) return { ...p }
  return {
    at_club: p.at_club && c.at_club !== false,
    wallet: p.wallet && !!c.wallet,
    credit_card: p.credit_card && !!c.credit_card,
    mada: p.mada && !!c.mada,
    split: p.split && c.split !== false
  }
}

export function pickFirstPaymentMethod(effectiveChannels) {
  const ch = effectiveChannels || DEFAULT_PLATFORM
  if (ch.at_club !== false) return 'at_club'
  if (ch.wallet) return 'wallet'
  if (ch.credit_card) return 'credit_card'
  if (ch.mada) return 'mada'
  return 'at_club'
}
