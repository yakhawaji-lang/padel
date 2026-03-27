/** True when booking id likely refers to a server (DB) row — not a local-only numeric id. */
export function isLikelyServerBookingId(id) {
  if (id == null || id === '') return false
  const s = String(id)
  if (s.startsWith('playtomic_')) return false
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  ) {
    return true
  }
  const n = Number(s)
  if (!Number.isNaN(n) && Number.isInteger(n) && n > 0 && n <= 999_999_999) {
    return false
  }
  return s.length >= 12
}

export function showInvoiceAlertFromApiResult(res, { language, clubId }) {
  const invNo = res?.invoice?.invoiceNumber
  if (!invNo || typeof window === 'undefined') return
  const base =
    `${window.location.origin}${(import.meta.env.BASE_URL || '/').replace(/\/$/, '') || ''}`
  const myBook = `${base}/my-bookings?from=${encodeURIComponent(String(clubId || ''))}`
  if (language === 'en') {
    window.alert(`Invoice ${invNo} was created or already on file. Members can view it under My bookings: ${myBook}`)
  } else {
    window.alert(`تم إنشاء الفاتورة ${invNo} (أو كانت مسجّلة مسبقاً). يطلع عليها العضو من «حجوزاتي»: ${myBook}`)
  }
}
