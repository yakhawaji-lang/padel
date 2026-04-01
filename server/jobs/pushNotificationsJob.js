/**
 * يفحص اشتراكات Web Push ويرسل إشعاراً عند زيادة أحد العدادات (بدون الزوار المباشرين).
 */
import { configureWebPushVapid, webpush } from '../lib/webPushVapid.js'
import { query } from '../db/pool.js'
import { computeClubNotificationCounts } from '../services/clubNotificationSummary.js'

const INTERVAL_MS = 25000
/** إن كان المتصفح يرسل ping «أنا في المقدمة» خلال هذه المدة نتخطى الإرسال لتفادي التكرار مع صوت الصفحة */
const FOREGROUND_SKIP_MS = 12000

/** ترتيب مطابق لـ ClubNotificationHub — أول فئة ازدادت تُذكر في الإشعار */
const CAT_ORDER = [
  'bookingsActiveNow',
  'completedBookingsToday',
  'locksActive',
  'bookingCompleteFlow',
  'bookingAwaitingPayments',
  'bookingExpiredWithPayment',
  'refundRequests',
  'storeSalesRecent',
  'storeLowStock',
  'newMembers',
]

const LABELS = {
  ar: {
    title: 'Playtix — نادٍ',
    bookingsActiveNow: 'حجوزات جارية على الملعب',
    completedBookingsToday: 'حجوزات مكتملة اليوم',
    locksActive: 'حجز مؤقت',
    bookingCompleteFlow: 'استكمال حجز',
    bookingAwaitingPayments: 'بانتظار الدفعات',
    bookingExpiredWithPayment: 'حجز منتهي مع دفعات',
    refundRequests: 'طلبات استرداد',
    storeSalesRecent: 'مبيعات المتجر',
    storeLowStock: 'مخزون منخفض',
    newMembers: 'أعضاء جدد',
  },
  en: {
    title: 'Playtix — Club',
    bookingsActiveNow: 'Ongoing court bookings',
    completedBookingsToday: 'Completed bookings today',
    locksActive: 'Active slot holds',
    bookingCompleteFlow: 'Bookings to complete',
    bookingAwaitingPayments: 'Awaiting payments',
    bookingExpiredWithPayment: 'Expired holds with payment',
    refundRequests: 'Refund requests',
    storeSalesRecent: 'Store sales',
    storeLowStock: 'Low stock',
    newMembers: 'New members',
  },
}

function fingerprintPush(counts) {
  const o = {}
  for (const k of CAT_ORDER) o[k] = Number(counts[k] ?? 0) || 0
  return JSON.stringify(o)
}

function firstIncreasedKey(prevStr, nextStr) {
  let prev = {}
  let next = {}
  try {
    prev = JSON.parse(prevStr || '{}')
  } catch {
    prev = {}
  }
  try {
    next = JSON.parse(nextStr || '{}')
  } catch {
    next = {}
  }
  for (const k of CAT_ORDER) {
    const a = Number(prev[k] ?? 0) || 0
    const b = Number(next[k] ?? 0) || 0
    if (b > a) return { key: k, value: b }
  }
  return null
}

let timer = null

export function startPushNotificationJob() {
  if (timer) return
  if (!configureWebPushVapid()) {
    console.warn('[push] VAPID keys missing — set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, optional VAPID_SUBJECT')
    return
  }

  const tick = async () => {
    try {
      const { rows } = await query(
        `SELECT id, club_id, endpoint, p256dh, auth_secret, locale, last_push_fingerprint, last_foreground_ping_at
         FROM club_push_subscriptions`,
        []
      )
      if (!rows?.length) return

      for (const row of rows) {
        const clubId = String(row.club_id || '').trim()
        if (!clubId) continue

        const { counts } = await computeClubNotificationCounts(clubId, 0)
        const fp = fingerprintPush(counts)
        const last = row.last_push_fingerprint

        if (last == null || last === '') {
          await query('UPDATE club_push_subscriptions SET last_push_fingerprint = ? WHERE id = ?', [fp, row.id])
          continue
        }

        if (last === fp) continue

        const inc = firstIncreasedKey(last, fp)
        if (!inc) {
          await query('UPDATE club_push_subscriptions SET last_push_fingerprint = ? WHERE id = ?', [fp, row.id])
          continue
        }

        const pingAt = row.last_foreground_ping_at ? new Date(row.last_foreground_ping_at).getTime() : 0
        if (pingAt && Date.now() - pingAt < FOREGROUND_SKIP_MS) {
          await query('UPDATE club_push_subscriptions SET last_push_fingerprint = ? WHERE id = ?', [fp, row.id])
          continue
        }

        const loc = String(row.locale || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar'
        const L = LABELS[loc] || LABELS.ar
        const label = L[inc.key] || inc.key
        const title = L.title
        const body = `${label}: ${inc.value}`

        const payload = JSON.stringify({
          title,
          body,
          tag: `playtix-${clubId}-${inc.key}-${Date.now()}`,
          url: `/app/admin/club/${encodeURIComponent(clubId)}/bookings`,
        })

        const subscription = {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth_secret },
        }

        try {
          await webpush.sendNotification(subscription, payload, { TTL: 3600 })
          await query('UPDATE club_push_subscriptions SET last_push_fingerprint = ? WHERE id = ?', [fp, row.id])
          console.log('[push] sent', clubId, inc.key, inc.value)
        } catch (e) {
          const status = e?.statusCode
          if (status === 410 || status === 404) {
            await query('DELETE FROM club_push_subscriptions WHERE id = ?', [row.id])
          } else {
            console.warn('[push] send failed', clubId, status || '', e?.body || e?.message || e)
          }
        }
      }
    } catch (e) {
      console.warn('[push] tick', e?.message || e)
    }
  }

  timer = setInterval(tick, INTERVAL_MS)
  setTimeout(tick, 5000)
}
