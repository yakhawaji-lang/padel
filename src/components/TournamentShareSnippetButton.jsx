import React, { useState, useCallback } from 'react'
import {
  buildTournamentPaymentSharePayload,
  shareOrCopyTournamentInvite,
} from '../utils/tournamentInviteShareText'

/**
 * زر يعرض جملة قصيرة فقط؛ يفتح مشاركة النظام أو ينسخ نصاً كاملاً (مع الرابط) دون إظهار الرابط في الواجهة.
 */
export default function TournamentShareSnippetButton({
  payUrl,
  clubName,
  amount,
  currency,
  language,
  tournamentLabel,
  className = '',
}) {
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)
  const lang = language === 'ar' ? 'ar' : 'en'

  const onActivate = useCallback(async () => {
    const url = String(payUrl || '').trim()
    if (!url) return
    setBusy(true)
    setFlash(null)
    try {
      const payload = buildTournamentPaymentSharePayload({
        payUrl: url,
        clubName,
        amount,
        currency,
        lang,
        tournamentLabel,
      })
      const r = await shareOrCopyTournamentInvite(payload, { language: lang })
      if (r.cancelled) return
      if (r.ok) {
        const msg =
          r.method === 'clipboard'
            ? lang === 'ar'
              ? 'تم نسخ رسالة الدعوة'
              : 'Invitation message copied'
            : r.method === 'share'
              ? lang === 'ar'
                ? 'تم فتح المشاركة'
                : 'Share opened'
              : lang === 'ar'
                ? 'تم الفتح في نافذة جديدة'
                : 'Opened in a new tab'
        setFlash(msg)
        window.setTimeout(() => setFlash(null), 2400)
      } else if (r.error) {
        setFlash(r.error)
        window.setTimeout(() => setFlash(null), 4000)
      }
    } finally {
      setBusy(false)
    }
  }, [payUrl, clubName, amount, currency, lang, tournamentLabel])

  const payloadPreview = buildTournamentPaymentSharePayload({
    payUrl: payUrl || 'https://',
    clubName,
    amount,
    currency,
    lang,
    tournamentLabel,
  })

  if (!String(payUrl || '').trim()) return null

  return (
    <div className={`tournament-share-snippet ${className}`.trim()}>
      <button
        type="button"
        className="tournament-share-snippet__btn"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          void onActivate()
        }}
      >
        {busy ? '…' : payloadPreview.tapLabel}
      </button>
      {flash ? <span className="tournament-share-snippet__flash">{flash}</span> : null}
    </div>
  )
}
