/**
 * إعداد web-push مرة واحدة (يُستدعى من مهمة الإشعارات ومسار الاختبار).
 */
import webpush from 'web-push'

function normalizeVapidSubject(raw) {
  const t = String(raw || '').trim()
  if (!t) return 'mailto:admin@localhost'
  if (/^mailto:/i.test(t) || /^https?:\/\//i.test(t)) return t
  return `mailto:${t}`
}

export function configureWebPushVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = normalizeVapidSubject(process.env.VAPID_SUBJECT || 'mailto:admin@localhost')
  if (!pub || !priv) return false
  webpush.setVapidDetails(subject, pub, priv)
  return true
}

export { webpush }
