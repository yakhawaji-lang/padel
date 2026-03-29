/**
 * Bilingual WhatsApp body for split payment invites (plain text — encode for wa.me).
 * Shared by client (splitInviteLinks, BookingPaymentShare) and server (bookings routes).
 */

function normalizeWebsite(url) {
  if (!url || typeof url !== 'string') return ''
  const t = url.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t.replace(/^\/+/, '')}`
}

/**
 * @param {object} opts
 * @param {string} [opts.clubName]
 * @param {string} [opts.bookingDate]
 * @param {string} [opts.startTime]
 * @param {string} [opts.endTime]
 * @param {string|number} [opts.shareAmount]
 * @param {string} [opts.currency]
 * @param {string} [opts.paymentUrl] — pay-invite or pay-share URL (empty for pre-confirm guest)
 * @param {string} [opts.clubPageUrl] — PlayTix public club page (/clubs/:id)
 * @param {string} [opts.externalWebsite] — club's own site from DB
 * @param {'pay_invite'|'pay_share'|'pre_confirm_guest'} [opts.mode]
 */
export function buildPaymentShareWhatsAppPlainText(opts = {}) {
  const {
    clubName = '',
    bookingDate = '—',
    startTime = '—',
    endTime = '',
    shareAmount = '',
    currency = 'SAR',
    paymentUrl = '',
    clubPageUrl = '',
    externalWebsite = '',
    mode = 'pay_invite',
  } = opts

  const name = (clubName || '').trim() || 'the club'
  const nameAr = name
  const timeLine = endTime ? `${startTime} – ${endTime}` : String(startTime || '—')
  const amt =
    shareAmount !== '' && shareAmount != null && !Number.isNaN(parseFloat(shareAmount))
      ? `${parseFloat(shareAmount).toFixed(2)} ${currency}`.trim()
      : `${currency}`

  const ext = normalizeWebsite(externalWebsite)
  const clubOnPlaytix = (clubPageUrl || '').trim()
  const webLineEn = ext || clubOnPlaytix || '—'
  const webLineAr = ext || clubOnPlaytix || '—'

  if (mode === 'pre_confirm_guest') {
    return [
      '━━━━━━━━━━━━━━━━',
      'PlayTix · بلايتكس',
      '━━━━━━━━━━━━━━━━',
      '',
      '🇬🇧 English:',
      "You're part of a split payment for a court booking.",
      'The booker will confirm the booking first — then they can send you your personal payment link from PlayTix.',
      '',
      `🏟 Club: ${name}`,
      `📅 Date: ${bookingDate}`,
      `🕐 Time: ${timeLine}`,
      `💰 Planned share (estimate): ${amt}`,
      '',
      clubOnPlaytix ? `🌐 Club page on PlayTix:\n${clubOnPlaytix}` : '',
      '',
      '🇸🇦 العربية:',
      'أنت ضمن مشاركة دفع لحجز ملعب.',
      'سيُؤكد الحاجز الحجز أولاً — ثم يمكنه إرسال رابط الدفع الشخصي من PlayTix.',
      '',
      `🏟 النادي: ${nameAr}`,
      `📅 التاريخ: ${bookingDate}`,
      `🕐 الوقت: ${timeLine}`,
      `💰 الحصة المتوقعة (تقديرية): ${amt}`,
      '',
      clubOnPlaytix ? `🌐 صفحة النادي على PlayTix:\n${clubOnPlaytix}` : '',
      '',
      'playtix.app',
    ]
      .filter(Boolean)
      .join('\n')
  }

  const openEn =
    mode === 'pay_share'
      ? "You've been added to a shared court booking payment."
      : "You're invited to pay your share of a court booking."
  const openAr =
    mode === 'pay_share'
      ? 'تمت إضافتك لمشاركة في دفع حجز ملعب.'
      : 'دعوة لدفع حصتك في حجز ملعب.'

  const payEn =
    mode === 'pay_share'
      ? 'Pay your share on PlayTix:'
      : 'Complete your share on PlayTix (sign in or register if needed):'
  const payAr =
    mode === 'pay_share' ? 'ادفع حصتك على PlayTix:' : 'أكمل دفع حصتك على PlayTix (سجّل أو سجّل الدخول إن لزم):'

  const url = (paymentUrl || '').trim()
  const lines = [
    '━━━━━━━━━━━━━━━━',
    'PlayTix · بلايتكس',
    '━━━━━━━━━━━━━━━━',
    '',
    '🇬🇧 English:',
    openEn,
    '',
    `🏟 Club: ${name}`,
    `📅 Date: ${bookingDate}`,
    `🕐 Time: ${timeLine}`,
    `💰 Your share: ${amt}`,
    '',
    url ? `${payEn}\n${url}` : payEn,
    '',
    `🌐 Club website / الموقع:\n${webLineEn}`,
    '',
    '—',
    '',
    '🇸🇦 العربية:',
    openAr,
    '',
    `🏟 النادي: ${nameAr}`,
    `📅 التاريخ: ${bookingDate}`,
    `🕐 الوقت: ${timeLine}`,
    `💰 مبلغ حصتك: ${amt}`,
    '',
    url ? `${payAr}\n${url}` : payAr,
    '',
    `🌐 موقع النادي:\n${webLineAr}`,
    '',
    'playtix.app',
  ]

  return lines.join('\n')
}
