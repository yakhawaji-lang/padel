/**
 * Bilingual WhatsApp body for split payment invites (plain text — encode for wa.me).
 * URLs on their own line after clear bilingual labels (WhatsApp autolinks).
 * No language-flag emojis or "English / العربية" section headers — same facts in EN + AR, compact lines where helpful.
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

/** Bilingual label lines, then URL (single), then blank line. */
function linkBlock(lineEn, lineAr, url) {
  const u = (url || '').trim()
  if (!u) return []
  return [lineEn, lineAr, u, '']
}

/**
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
    /** When set with a pay URL, use direct pay-share wording (registered members). */
    tournamentPayLinkStyle = '',
  } = opts

  const name = (clubName || '').trim() || 'the club'
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

  const detailLines = [
    `Club · النادي: ${name}`,
    `Date · التاريخ: ${bookingDate}`,
    `Time · الوقت: ${timeLine}`,
  ]

  const linkSection = []
  if (pay) {
    if (isTournament) {
      if (mode === 'pay_share' && tournamentPayLinkStyle === 'direct_share') {
        linkSection.push(
          ...linkBlock(
            'Open this link to pay your tournament share on PlayTix:',
            'افتح الرابط لدفع حصتك في البطولة على PlayTix:',
            pay
          )
        )
      } else if (mode === 'pay_share') {
        linkSection.push(
          ...linkBlock(
            'Open this link to join the club and pay your tournament share:',
            'افتح الرابط للانضمام إلى النادي ودفع حصة البطولة:',
            pay
          )
        )
      } else {
        linkSection.push(
          ...linkBlock(
            'Open this link to register (or sign in), join the club, and pay your tournament share:',
            'افتح الرابط للتسجيل (أو تسجيل الدخول) والانضمام للنادي ودفع حصة البطولة:',
            pay
          )
        )
      }
    } else if (mode === 'pay_share') {
      linkSection.push(
        ...linkBlock(
          'Open this link to pay your share on PlayTix:',
          'افتح الرابط لدفع حصتك على PlayTix:',
          pay
        )
      )
    } else {
      linkSection.push(
        ...linkBlock(
          'Open this link to complete your share on PlayTix (register or sign in if needed):',
          'افتح الرابط لإكمال حصتك على PlayTix (سجّل أو سجّل الدخول عند الحاجة):',
          pay
        )
      )
    }
  }
  if (clubOnPlaytix) {
    linkSection.push(
      ...linkBlock(
        'Open this link for the club page on PlayTix:',
        'افتح الرابط لصفحة النادي على PlayTix:',
        clubOnPlaytix
      )
    )
  }
  if (ext && ext !== clubOnPlaytix) {
    linkSection.push(
      ...linkBlock("Open this link for the club's website:", 'افتح الرابط لموقع النادي:', ext)
    )
  }

  if (mode === 'pre_confirm_guest') {
    const openEn = isTournament
      ? `Tournament participation (estimate) — ${tlab.en} at ${name}.`
      : "You're part of a split payment for a court booking."
    const openAr = isTournament
      ? `مشاركة في بطولة (تقديرية) — ${tlab.ar} في ${name}.`
      : 'أنت ضمن مشاركة دفع لحجز ملعب.'
    const subEn = isTournament
      ? 'The booker will confirm first — then you will receive your personal payment link on PlayTix.'
      : 'The booker will confirm the booking first — then they can send you your personal payment link from PlayTix.'
    const subAr = isTournament
      ? 'سيُؤكد منظم الحجز أولاً — ثم يصلك رابط الدفع الشخصي على PlayTix.'
      : 'سيُؤكد منظم الحجز أولاً — ثم يمكنه إرسال رابط الدفع الشخصي من PlayTix.'

    return [
      '━━━━━━━━━━━━━━━━',
      'PlayTix · بلايتكس',
      '━━━━━━━━━━━━━━━━',
      '',
      openEn,
      openAr,
      '',
      subEn,
      subAr,
      '',
      ...detailLines,
      `Planned share (estimate) · الحصة المتوقعة (تقديرية): ${amt}`,
      '',
      ...(linkSection.length ? ['────────', '', ...linkSection] : []),
      'playtix.app',
    ]
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  let headEn
  let headAr
  if (isTournament) {
    headEn = `Tournament participation booking — ${tlab.en} at ${name}.`
    headAr = `حجز مشاركة في بطولة — ${tlab.ar} في ${name}.`
  } else {
    headEn =
      mode === 'pay_share'
        ? "You've been added to a shared court booking payment."
        : "You're invited to pay your share of a court booking."
    headAr =
      mode === 'pay_share'
        ? 'تمت إضافتك لمشاركة في دفع حجز ملعب.'
        : 'دعوة لدفع حصتك في حجز ملعب.'
  }

  return [
    '━━━━━━━━━━━━━━━━',
    'PlayTix · بلايتكس',
    '━━━━━━━━━━━━━━━━',
    '',
    headEn,
    headAr,
    '',
    ...detailLines,
    `Your share · مبلغ حصتك: ${amt}`,
    '',
    ...(linkSection.length ? ['────────', '', ...linkSection] : []),
    'playtix.app',
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
