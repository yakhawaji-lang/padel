/**
 * Bilingual WhatsApp body for split payment invites (plain text — encode for wa.me).
 * Each URL is on its own line after a clear EN/AR label (WhatsApp autolinks URLs; no HTML anchors).
 * Shared by client and server (bookings routes).
 */

function normalizeWebsite(url) {
  if (!url || typeof url !== 'string') return ''
  const t = url.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t.replace(/^\/+/, '')}`
}

const TOURNAMENT_KIND_LABELS = {
  king: { en: 'King of the Court', ar: 'ملك الملعب' },
  social: { en: 'Social tournament', ar: 'بطولة سوشيال' },
}

function tournamentLabels(kind) {
  const k = String(kind || '').toLowerCase() === 'social' ? 'social' : 'king'
  return TOURNAMENT_KIND_LABELS[k]
}

function labeledPair(enLabel, arLabel, url) {
  const u = (url || '').trim()
  if (!u) return []
  return [`🇬🇧 ${enLabel}`, u, '', `🇸🇦 ${arLabel}`, u, '']
}

/**
 * @param {object} opts
 * @param {'pay_invite'|'pay_share'|'pre_confirm_guest'} [opts.mode]
 * @param {''|'king'|'social'} [opts.tournamentKind]
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
    tournamentKind = '',
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
  const pay = (paymentUrl || '').trim()
  const isTournament = tournamentKind === 'king' || tournamentKind === 'social'
  const tlab = isTournament ? tournamentLabels(tournamentKind) : null

  const linkSection = []
  if (pay) {
    if (isTournament) {
      if (mode === 'pay_share') {
        linkSection.push(
          ...labeledPair(
            'Open to join the club & pay your tournament share:',
            'افتح للانضمام للنادي ودفع حصة البطولة:',
            pay
          )
        )
      } else {
        linkSection.push(
          ...labeledPair(
            'Open to register (or sign in), join the club & pay your tournament share:',
            'افتح للتسجيل (أو الدخول) والانضمام للنادي ودفع حصة البطولة:',
            pay
          )
        )
      }
    } else if (mode === 'pay_share') {
      linkSection.push(...labeledPair('Open to pay your share on PlayTix:', 'افتح لدفع حصتك على PlayTix:', pay))
    } else {
      linkSection.push(
        ...labeledPair(
          'Open to complete your share on PlayTix (register or sign in if needed):',
          'افتح لإكمال حصتك على PlayTix (سجّل أو سجّل الدخول إن لزم):',
          pay
        )
      )
    }
  }
  if (clubOnPlaytix) {
    linkSection.push(...labeledPair('Open the club page on PlayTix:', 'افتح صفحة النادي على PlayTix:', clubOnPlaytix))
  }
  if (ext && ext !== clubOnPlaytix) {
    linkSection.push(...labeledPair("Open the club's website:", 'افتح موقع النادي:', ext))
  }

  if (mode === 'pre_confirm_guest') {
    const openEn = isTournament
      ? `Tournament participation (estimate) — ${tlab.en} at ${name}.`
      : "You're part of a split payment for a court booking."
    const openAr = isTournament
      ? `مشاركة في بطولة (تقديرية) — ${tlab.ar} في ${nameAr}.`
      : 'أنت ضمن مشاركة دفع لحجز ملعب.'
    const subEn = isTournament
      ? 'The booker will confirm first — then you will get your personal payment link on PlayTix.'
      : 'The booker will confirm the booking first — then they can send you your personal payment link from PlayTix.'
    const subAr = isTournament
      ? 'سيُؤكد الحاجز الحجز أولاً — ثم يصلك رابط الدفع الشخصي على PlayTix.'
      : 'سيُؤكد الحاجز الحجز أولاً — ثم يمكنه إرسال رابط الدفع الشخصي من PlayTix.'

    return [
      '━━━━━━━━━━━━━━━━',
      'PlayTix · بلايتكس',
      '━━━━━━━━━━━━━━━━',
      '',
      '🇬🇧 English:',
      openEn,
      subEn,
      '',
      `🏟 Club: ${name}`,
      `📅 Date: ${bookingDate}`,
      `🕐 Time: ${timeLine}`,
      `💰 Planned share (estimate): ${amt}`,
      '',
      '🇸🇦 العربية:',
      openAr,
      subAr,
      '',
      `🏟 النادي: ${nameAr}`,
      `📅 التاريخ: ${bookingDate}`,
      `🕐 الوقت: ${timeLine}`,
      `💰 الحصة المتوقعة (تقديرية): ${amt}`,
      '',
      ...(linkSection.length ? ['—— Links · روابط ——', '', ...linkSection] : []),
      'playtix.app',
    ]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  let openEn
  let openAr
  if (isTournament) {
    openEn = `Tournament participation booking — ${tlab.en} at ${name}.`
    openAr = `حجز مشاركة في بطولة — ${tlab.ar} في ${nameAr}.`
  } else {
    openEn =
      mode === 'pay_share'
        ? "You've been added to a shared court booking payment."
        : "You're invited to pay your share of a court booking."
    openAr =
      mode === 'pay_share'
        ? 'تمت إضافتك لمشاركة في دفع حجز ملعب.'
        : 'دعوة لدفع حصتك في حجز ملعب.'
  }

  return [
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
    '🇸🇦 العربية:',
    openAr,
    '',
    `🏟 النادي: ${nameAr}`,
    `📅 التاريخ: ${bookingDate}`,
    `🕐 الوقت: ${timeLine}`,
    `💰 مبلغ حصتك: ${amt}`,
    '',
    ...(linkSection.length ? ['—— Links · روابط ——', '', ...linkSection] : []),
    'playtix.app',
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
