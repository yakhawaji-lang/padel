/**
 * نص دعوة قصير للمشاركة (واتساب / نسخ / Web Share) دون عرض الرابط الطويل في الواجهة.
 */

export function buildTournamentPaymentSharePayload({
  payUrl,
  clubName,
  amount,
  currency,
  lang,
  tournamentLabel,
}) {
  const c = String(currency || 'SAR').trim() || 'SAR'
  const amt = typeof amount === 'number' ? amount.toFixed(2) : String(amount || '').trim()
  const club = String(clubName || '').trim() || (lang === 'ar' ? 'النادي' : 'Club')
  const tt = String(tournamentLabel || '').trim()
  const line1 =
    lang === 'ar'
      ? tt
        ? `🎾 ${tt} — ${club}`
        : `🎾 بطولة — ${club}`
      : tt
        ? `🎾 ${tt} — ${club}`
        : `🎾 Tournament — ${club}`
  const line2 =
    lang === 'ar'
      ? `ادفع حصتك: ${amt} ${c} — اضغط الرابط أدناه لإكمال الدفع.`
      : `Your share: ${amt} ${c} — tap the link below to pay.`
  const fullText = `${line1}\n${line2}\n${payUrl}`.trim()
  const tapLabel =
    lang === 'ar' ? 'اضغط للمشاركة وإكمال الدفع' : 'Tap to share & complete payment'
  return { tapLabel, line1, line2, fullText, payUrl: String(payUrl || '').trim() }
}

export async function shareOrCopyTournamentInvite(payload, { language = 'en' } = {}) {
  const { tapLabel, fullText, payUrl } = payload
  const errCopy =
    language === 'ar' ? 'تعذّر النسخ. انسخ الرابط يدوياً من المتصفح.' : 'Could not copy. Copy the link from the address bar if needed.'
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: tapLabel,
        text: fullText,
        url: payUrl || undefined,
      })
      return { ok: true, method: 'share' }
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: false, cancelled: true }
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(fullText)
      return { ok: true, method: 'clipboard' }
    } catch {
      /* fall through */
    }
  }
  if (payUrl && typeof window !== 'undefined') {
    window.open(payUrl, '_blank', 'noopener,noreferrer')
    return { ok: true, method: 'fallback_open' }
  }
  return { ok: false, error: errCopy }
}
