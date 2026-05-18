/**
 * دمج قنوات الدفع: المنصة (إعدادات رئيسية) + النادي (تفعيل/تعطيل لكل نادي).
 * القنوات الإلكترونية تتطلب تفعيل المنصة والنادي معاً. at_club و split: تعطيل النادي يكفي لإخفائها.
 */

const DEFAULT_PLATFORM = {
  at_club: true,
  wallet: false,
  credit_card: false,
  mada: false,
  geidea: false,
  split: true
}

export function getEffectivePaymentChannels(platformEnabledChannels, clubPaymentEnabledChannels) {
  const plat = platformEnabledChannels && typeof platformEnabledChannels === 'object' ? platformEnabledChannels : {}
  const p = {
    at_club: plat.at_club !== false,
    /** مفعّل افتراضياً ما لم يعطّله مدير المنصة صراحةً (false) */
    wallet: plat.wallet !== false,
    credit_card: !!plat.credit_card,
    mada: !!plat.mada,
    geidea: !!plat.geidea,
    split: plat.split !== false
  }
  const c =
    clubPaymentEnabledChannels && typeof clubPaymentEnabledChannels === 'object' && !Array.isArray(clubPaymentEnabledChannels)
      ? clubPaymentEnabledChannels
      : null
  if (!c) return { ...p }
  return {
    at_club: p.at_club && c.at_club !== false,
    /** يظهر الدفع بالمحفظة ما لم يعطّله النادي صراحةً (false). غياب المفتاح = مسموح إن سمحت المنصة. */
    wallet: p.wallet && c.wallet !== false,
    credit_card: p.credit_card && !!c.credit_card,
    mada: p.mada && !!c.mada,
    /** Geidea: على مستوى المنصة فقط. الأندية تستفيد افتراضياً ما لم تعطّله صراحةً (false). */
    geidea: p.geidea && c.geidea !== false,
    split: p.split && c.split !== false
  }
}

export function pickFirstPaymentMethod(effectiveChannels) {
  const ch = effectiveChannels || DEFAULT_PLATFORM
  if (ch.at_club !== false) return 'at_club'
  if (ch.wallet) return 'wallet'
  if (ch.geidea) return 'geidea'
  if (ch.credit_card) return 'credit_card'
  if (ch.mada) return 'mada'
  return 'at_club'
}
