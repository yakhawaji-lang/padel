import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchClubNotificationSummary,
  fetchPushVapidPublic,
  postPushForeground,
  postPushTabHidden,
  postPushSubscribe,
  postPushUnsubscribe,
} from '../../api/dbClient'
import './ClubNotificationHub.css'

const POLL_MS = 25000

const CAT_DEFS = [
  { id: 'bookingsActiveNow', key: 'bookingsActiveNow', group: 'bookings', color: '#0ea5e9', adminPath: 'bookings', adminSearch: '' },
  { id: 'completedBookingsToday', key: 'completedBookingsToday', group: 'bookings', color: '#22c55e', adminPath: 'bookings', adminSearch: '' },
  { id: 'locksActive', key: 'locksActive', group: 'bookings', color: '#0284c7', adminPath: 'bookings', adminSearch: '' },
  { id: 'bookingCompleteFlow', key: 'bookingCompleteFlow', group: 'bookings', color: '#7c3aed', adminPath: 'bookings', adminSearch: '' },
  { id: 'bookingAwaitingPayments', key: 'bookingAwaitingPayments', group: 'bookings', color: '#d97706', adminPath: 'bookings', adminSearch: '' },
  { id: 'bookingExpiredWithPayment', key: 'bookingExpiredWithPayment', group: 'bookings', color: '#dc2626', adminPath: 'bookings', adminSearch: '' },
  { id: 'refundRequests', key: 'refundRequests', group: 'payments', color: '#db2777', adminPath: 'bookings', adminSearch: '?focusRefund=1' },
  { id: 'storeSalesRecent', key: 'storeSalesRecent', group: 'store', color: '#059669', adminPath: 'store', adminSearch: '' },
  { id: 'storeLowStock', key: 'storeLowStock', group: 'store', color: '#ea580c', adminPath: 'store', adminSearch: '' },
  { id: 'newMembers', key: 'newMembers', group: 'members', color: '#4f46e5', adminPath: 'members', adminSearch: '' },
  { id: 'viewers', key: 'viewers', group: 'live', color: '#0d9488', adminPath: 'dashboard', adminSearch: '' },
]

const GROUP_ORDER = ['bookings', 'payments', 'store', 'members', 'live']

/** أيقونات خطية ثابتة لكل فئة إشعار (شريط جانبي + لوحة) */
function NotificationCategoryIcon({ id, size = 14 }) {
  const stroke = 'currentColor'
  const s = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  switch (id) {
    case 'bookingsActiveNow':
      return (
        <svg {...s} aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
          <path d="M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" opacity="0.85" />
        </svg>
      )
    case 'completedBookingsToday':
      return (
        <svg {...s} aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <path d="M8 2v4M16 2v4M3 10h18" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    case 'locksActive':
      return (
        <svg {...s} aria-hidden>
          <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      )
    case 'bookingCompleteFlow':
      return (
        <svg {...s} aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <path d="M8 2v4M16 2v4M3 10h18" />
          <path d="m9 16 2 2 4-4" />
        </svg>
      )
    case 'bookingAwaitingPayments':
      return (
        <svg {...s} aria-hidden>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4M14 15h.01" />
        </svg>
      )
    case 'bookingExpiredWithPayment':
      return (
        <svg {...s} aria-hidden>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4M12 17h.01" strokeWidth="2.25" />
        </svg>
      )
    case 'refundRequests':
      return (
        <svg {...s} aria-hidden>
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
      )
    case 'storeSalesRecent':
      return (
        <svg {...s} aria-hidden>
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      )
    case 'storeLowStock':
      return (
        <svg {...s} aria-hidden>
          <path d="m21 16-4-4-4 4" />
          <path d="M17 12v9" />
          <path d="M3 3h8l2 6h9" />
          <path d="M3 12h5" />
        </svg>
      )
    case 'newMembers':
      return (
        <svg {...s} aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
      )
    case 'viewers':
      return (
        <svg {...s} aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    default:
      return (
        <svg {...s} aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      )
  }
}

function labelsForLang(lang) {
  const en = {
    hubTitle: 'Notifications',
    markRead: 'Mark all as read',
    openFeed: 'Open',
    liveNow: 'Live',
    visitorsNow: 'Visitors on club page now',
    groupBookings: 'Bookings',
    groupPayments: 'Payments & refunds',
    groupStore: 'Store',
    groupMembers: 'Members',
    groupLive: 'Live',
    bookingsActiveNow: 'Ongoing bookings (on court now)',
    completedBookingsToday: 'Completed bookings today (until slot ends)',
    locksActive: 'Active slot holds',
    bookingCompleteFlow: 'Bookings to complete',
    bookingAwaitingPayments: 'Awaiting payment completion',
    bookingExpiredWithPayment: 'Expired holds with payments',
    refundRequests: 'Refund requests',
    storeSalesRecent: 'Store sales (48h)',
    storeLowStock: 'Low / out of stock',
    newMembers: 'New members (7 days)',
    viewers: 'Visitors now',
    tickerSep: ' · ',
    reducedMotion: 'Disable motion',
    soundOn: 'Bell sound on',
    soundOff: 'Bell sound muted',
    soundMuteAria: 'Mute notification bell',
    soundUnmuteAria: 'Enable notification bell',
    desktopNotifyTitle: 'System alerts when away',
    desktopNotifyHint:
      'When the server has VAPID keys: Web Push (tab can be closed). Otherwise: browser notifications while the browser stays open. HTTPS and permission required.',
    desktopNotifyOn: 'Browser alerts on',
    desktopNotifyOff: 'Disable background alerts',
    desktopPushOn: 'Web Push on (tab can be closed)',
    desktopPageOn: 'Browser-only alerts on',
    desktopEnableBackground: 'Enable background alerts',
    desktopDenied: 'Notifications blocked — allow them in the browser site settings.',
  }
  const ar = {
    hubTitle: 'الإشعارات',
    markRead: 'تأكيد القراءة لجميع البنود',
    openFeed: 'فتح',
    liveNow: 'مباشر',
    visitorsNow: 'زوار صفحة النادي الآن',
    groupBookings: 'الحجوزات',
    groupPayments: 'المدفوعات والاسترداد',
    groupStore: 'المتجر',
    groupMembers: 'الأعضاء',
    groupLive: 'مباشر',
    bookingsActiveNow: 'حجوزات قائمة (جارية على الملعب الآن)',
    completedBookingsToday: 'حجوزات مكتملة اليوم (حتى انتهاء الوقت)',
    locksActive: 'جاري حجز (حجز مؤقت)',
    bookingCompleteFlow: 'استكمال حجز',
    bookingAwaitingPayments: 'بانتظار إكمال الدفعات',
    bookingExpiredWithPayment: 'حجز منتهي المهلة مع دفعات',
    refundRequests: 'طلبات استرداد مبالغ',
    storeSalesRecent: 'مبيعات المتجر (٤٨ ساعة)',
    storeLowStock: 'مخزون منخفض أو نفاد',
    newMembers: 'تسجيل أعضاء جدد (٧ أيام)',
    viewers: 'الزوار الآن',
    tickerSep: ' · ',
    reducedMotion: 'تقليل الحركة',
    soundOn: 'صوت الجرس مفعّل',
    soundOff: 'صوت الجرس مكتوم',
    soundMuteAria: 'كتم صوت جرس الإشعارات',
    soundUnmuteAria: 'تشغيل صوت جرس الإشعارات',
    desktopNotifyTitle: 'تنبيهات النظام عند ترك الصفحة',
    desktopNotifyHint:
      'إن وُجدت مفاتيح VAPID على الخادم: Web Push (يعمل حتى مع إغلاق التبويب). وإلا: إشعارات المتصفح مع بقاء المتصفح مفتوحاً. يتطلب HTTPS وإذناً.',
    desktopNotifyOn: 'تنبيهات المتصفح مفعّلة',
    desktopNotifyOff: 'إيقاف تنبيهات الخلفية',
    desktopPushOn: 'Web Push مفعّل (يمكن إغلاق التبويب)',
    desktopPageOn: 'تنبيهات المتصفح فقط',
    desktopEnableBackground: 'تفعيل تنبيهات الخلفية',
    desktopDenied: 'الإشعارات مرفوضة — اسمح بها من إعدادات الموقع في المتصفح.',
  }
  return lang === 'ar' ? ar : en
}

function readAck(clubId) {
  try {
    const raw = localStorage.getItem(`playtix_notify_ack_v2_${clubId}`)
    if (!raw) return { fingerprint: '', catAck: {} }
    const j = JSON.parse(raw)
    return { fingerprint: j.fingerprint || '', catAck: j.catAck || {} }
  } catch {
    return { fingerprint: '', catAck: {} }
  }
}

function writeAck(clubId, ack) {
  try {
    localStorage.setItem(`playtix_notify_ack_v2_${clubId}`, JSON.stringify(ack))
  } catch { /* ignore */ }
}

const SOUND_MUTED_KEY = 'playtix_notify_sound_muted'

function readSoundMuted() {
  try {
    return localStorage.getItem(SOUND_MUTED_KEY) === '1'
  } catch {
    return false
  }
}

function writeSoundMuted(muted) {
  try {
    localStorage.setItem(SOUND_MUTED_KEY, muted ? '1' : '0')
  } catch { /* ignore */ }
}

const DESKTOP_NOTIFY_KEY = 'playtix_notify_desktop_v1'

function readDesktopNotify() {
  try {
    return localStorage.getItem(DESKTOP_NOTIFY_KEY) === '1'
  } catch {
    return false
  }
}

function writeDesktopNotify(on) {
  try {
    localStorage.setItem(DESKTOP_NOTIFY_KEY, on ? '1' : '0')
  } catch { /* ignore */ }
}

const PUSH_SUBSCRIBED_KEY = 'playtix_notify_push_v1'

function readPushSubscribed() {
  try {
    return localStorage.getItem(PUSH_SUBSCRIBED_KEY) === '1'
  } catch {
    return false
  }
}

function writePushSubscribed(on) {
  try {
    localStorage.setItem(PUSH_SUBSCRIBED_KEY, on ? '1' : '0')
  } catch { /* ignore */ }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

function canUseDesktopNotifications() {
  return typeof window !== 'undefined' && typeof Notification !== 'undefined'
}

/** إشعار نظام (صوت من النظام) عندما الصفحة ليست في التركيز — Web Audio غالباً لا يعمل هناك */
function showClubDesktopNotification({ title, body, tag }) {
  if (!canUseDesktopNotifications() || Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body,
      tag: String(tag),
      silent: false,
    })
  } catch {
    /* ignore */
  }
}

let sharedAudioCtx = null
/** إشعار وصل قبل أن يُسمح بالصوت — يُشغَّل بعد أول تفاعل */
let pendingNotificationSoundKey = null

function getAudioContextClass() {
  return typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
}

/** إنشاء السياق فقط ضمن تفاعل مستخدم (نقرة/لمس) — سياسات المتصفح */
function createAudioContextFromUserGesture() {
  const Ctx = getAudioContextClass()
  if (!Ctx) return null
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') sharedAudioCtx = new Ctx()
    return sharedAudioCtx
  } catch {
    return null
  }
}

function getExistingAudioContext() {
  return sharedAudioCtx && sharedAudioCtx.state !== 'closed' ? sharedAudioCtx : null
}

/** نغمة قصيرة — مِيل خطي للـ gain لتفادي أخطاء exponential في بعض المتصفحات */
function playTone(ctx, tStart, freq, durationSec, type, peakGain, freqEnd = null) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, tStart)
  if (freqEnd != null && Math.abs(freqEnd - freq) > 1) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, freqEnd), tStart + durationSec * 0.92)
  }
  const g0 = Math.max(0.0001, peakGain)
  g.gain.setValueAtTime(0.0001, tStart)
  g.gain.linearRampToValueAtTime(g0, tStart + Math.min(0.025, durationSec * 0.15))
  g.gain.linearRampToValueAtTime(0.0001, tStart + durationSec)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(tStart)
  osc.stop(tStart + durationSec + 0.06)
}

function scheduleCategoryTones(ctx, catKey, t0) {
  switch (catKey) {
    case 'bookingsActiveNow':
      playTone(ctx, t0, 523.25, 0.24, 'sine', 0.1)
      playTone(ctx, t0 + 0.11, 659.25, 0.28, 'sine', 0.085)
      break
    case 'completedBookingsToday':
      playTone(ctx, t0, 440, 0.06, 'triangle', 0.1)
      playTone(ctx, t0 + 0.065, 554.37, 0.06, 'triangle', 0.095)
      playTone(ctx, t0 + 0.13, 659.25, 0.07, 'triangle', 0.09)
      playTone(ctx, t0 + 0.22, 880, 0.18, 'sine', 0.07)
      break
    case 'locksActive':
      playTone(ctx, t0, 1850, 0.04, 'square', 0.042)
      playTone(ctx, t0 + 0.055, 2200, 0.038, 'square', 0.036)
      break
    case 'bookingCompleteFlow':
      playTone(ctx, t0, 392, 0.11, 'triangle', 0.095)
      playTone(ctx, t0 + 0.1, 493.88, 0.11, 'triangle', 0.085)
      playTone(ctx, t0 + 0.2, 587.33, 0.16, 'triangle', 0.09)
      break
    case 'bookingAwaitingPayments':
      playTone(ctx, t0, 196, 0.18, 'sine', 0.12)
      playTone(ctx, t0 + 0.2, 246.94, 0.22, 'sine', 0.1)
      break
    case 'bookingExpiredWithPayment':
      playTone(ctx, t0, 300, 0.14, 'sawtooth', 0.065, 165)
      playTone(ctx, t0 + 0.16, 260, 0.18, 'sawtooth', 0.055, 140)
      break
    case 'refundRequests':
      playTone(ctx, t0, 523.25, 0.12, 'sine', 0.09, 349.23)
      playTone(ctx, t0 + 0.14, 392, 0.18, 'sine', 0.08, 261.63)
      break
    case 'storeSalesRecent':
      playTone(ctx, t0, 783.99, 0.08, 'sine', 0.11)
      playTone(ctx, t0 + 0.09, 1046.5, 0.1, 'sine', 0.095)
      playTone(ctx, t0 + 0.2, 1318.51, 0.12, 'sine', 0.075)
      break
    case 'storeLowStock':
      playTone(ctx, t0, 880, 0.1, 'triangle', 0.085, 523.25)
      playTone(ctx, t0 + 0.12, 659.25, 0.15, 'triangle', 0.07, 392)
      break
    case 'newMembers':
      playTone(ctx, t0, 329.63, 0.1, 'sine', 0.08)
      playTone(ctx, t0 + 0.08, 415.3, 0.1, 'sine', 0.09)
      playTone(ctx, t0 + 0.16, 523.25, 0.12, 'sine', 0.095)
      playTone(ctx, t0 + 0.28, 659.25, 0.18, 'sine', 0.075)
      break
    case 'viewers':
      playTone(ctx, t0, 987.77, 0.065, 'sine', 0.055)
      break
    default:
      playTone(ctx, t0, 659.25, 0.14, 'sine', 0.085)
  }
}

/**
 * يُستدعى من نقرة/لمس (شريط الإشعارات، كتم الصوت، أي نقرة على الصفحة بعد التثبيت).
 * ينشئ AudioContext إن لزم ويستأنف التشغيل ويشغّل أي صوت معلّق.
 */
function primeClubNotificationAudio() {
  const ctx = createAudioContextFromUserGesture()
  if (!ctx) return
  const run = () => {
    const key = pendingNotificationSoundKey
    pendingNotificationSoundKey = null
    if (!key || readSoundMuted()) return
    try {
      scheduleCategoryTones(ctx, key, ctx.currentTime + 0.03)
    } catch {
      /* ignore */
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().then(run).catch(() => {})
  } else {
    run()
  }
}

/**
 * صوت عند زيادة العداد — يتطلّب سياقاً نشطاً أو يُخزَّن حتى أول تفاعل.
 * @param {string} catKey
 */
function playNotificationSound(catKey) {
  if (readSoundMuted()) return
  const ctx = getExistingAudioContext()
  if (!ctx) {
    pendingNotificationSoundKey = catKey
    return
  }

  const play = () => {
    try {
      scheduleCategoryTones(ctx, catKey, ctx.currentTime + 0.03)
    } catch {
      /* ignore */
    }
  }

  if (ctx.state === 'suspended') {
    pendingNotificationSoundKey = catKey
    ctx
      .resume()
      .then(() => {
        pendingNotificationSoundKey = null
        play()
      })
      .catch(() => {})
  } else {
    play()
  }
}

/**
 * @param {{ clubId: string, language: string, mode: 'admin' | 'public', showUi: boolean, showTicker?: boolean, docked?: boolean, children?: import('react').ReactNode }} props
 */
export default function ClubNotificationHub({ clubId, language, mode, showUi, showTicker = true, docked = false, children = null }) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [err, setErr] = useState(null)
  const [ackTick, setAckTick] = useState(0)
  const [soundMuted, setSoundMuted] = useState(() => readSoundMuted())
  const [desktopNotify, setDesktopNotify] = useState(() => readDesktopNotify())
  const [pushSubscribed, setPushSubscribedState] = useState(() => readPushSubscribed())
  const [desktopDeniedHint, setDesktopDeniedHint] = useState(false)
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  const pollRef = useRef(null)
  const prevPollCountsRef = useRef(null)
  const lastForegroundPushPingRef = useRef(0)

  const t = useMemo(() => labelsForLang(language), [language])

  const counts = summary?.counts || {}

  const ack = useMemo(() => readAck(clubId), [clubId, ackTick, summary?.fingerprint])

  const unreadByCat = useMemo(() => {
    const out = {}
    for (const c of CAT_DEFS) {
      const n = Number(counts[c.key] ?? 0) || 0
      const ackN = Number(ack.catAck[c.key] ?? -1)
      out[c.id] = n > ackN ? n : 0
    }
    return out
  }, [counts, ack.catAck])

  const hasUnread = useMemo(() => Object.values(unreadByCat).some((n) => n > 0), [unreadByCat])
  const tickerStale = summary?.fingerprint && summary.fingerprint !== ack.fingerprint

  const load = useCallback(async () => {
    if (!clubId || !showUi) return
    try {
      const data = await fetchClubNotificationSummary(clubId)
      if (data?.ok && data.counts) setSummary(data)
      setErr(null)
    } catch (e) {
      setErr(e?.message || '')
    }
  }, [clubId, showUi])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!showUi) return undefined
    pollRef.current = setInterval(() => {
      load()
    }, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [load, showUi])

  useEffect(() => {
    if (!showUi) return undefined
    const onVis = () => {
      if (document.visibilityState === 'visible') load()
      else if (document.visibilityState === 'hidden' && readPushSubscribed()) {
        ;(async () => {
          try {
            const reg = await navigator.serviceWorker?.ready
            const sub = await reg?.pushManager?.getSubscription()
            if (sub?.endpoint) await postPushTabHidden(sub.endpoint)
          } catch {
            /* ignore */
          }
        })()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load, showUi])

  useEffect(() => {
    if (!showUi) return undefined
    const onSync = () => load()
    window.addEventListener('clubs-synced', onSync)
    return () => window.removeEventListener('clubs-synced', onSync)
  }, [load, showUi])

  useEffect(() => {
    if (!showUi) return undefined
    if (!readPushSubscribed()) return undefined
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker?.ready
        const sub = await reg?.pushManager?.getSubscription()
        if (!sub) {
          writePushSubscribed(false)
          setPushSubscribedState(false)
        }
      } catch {
        /* ignore */
      }
    })()
    return undefined
  }, [showUi])

  useEffect(() => {
    if (!showUi || !summary?.fingerprint) return undefined
    if (!readPushSubscribed()) return undefined
    if (typeof document === 'undefined' || !document.hasFocus()) return undefined
    if (Date.now() - lastForegroundPushPingRef.current < 22000) return undefined
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker?.ready
        const sub = await reg?.pushManager?.getSubscription()
        if (!sub?.endpoint) return
        lastForegroundPushPingRef.current = Date.now()
        await postPushForeground(sub.endpoint)
      } catch {
        /* ignore */
      }
    })()
    return undefined
  }, [showUi, summary?.fingerprint])

  useEffect(() => {
    if (!expanded) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expanded])

  /** أول نقرة/لمس في الصفحة تنشئ AudioContext وتُفعل الصوت (متطلبات المتصفح) */
  useEffect(() => {
    if (!showUi) return undefined
    const onInteract = () => {
      primeClubNotificationAudio()
    }
    document.addEventListener('pointerdown', onInteract, { capture: true, passive: true })
    document.addEventListener('keydown', onInteract, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', onInteract, true)
      document.removeEventListener('keydown', onInteract, true)
    }
  }, [showUi])

  const markAllRead = useCallback(() => {
    if (!summary?.fingerprint) return
    const catAck = {}
    for (const c of CAT_DEFS) {
      catAck[c.key] = Number(counts[c.key] ?? 0) || 0
    }
    writeAck(clubId, { fingerprint: summary.fingerprint, catAck })
    setExpanded(false)
    setAckTick((x) => x + 1)
  }, [clubId, summary, counts])

  /** عند فتح بند (تنفيذ/انتقال) نعتبر الفئة مُقرأة فيزول الوميض عنها */
  const ackCategoryRead = useCallback(
    (catKey) => {
      if (!summary?.fingerprint) return
      const current = readAck(clubId)
      const n = Number(counts[catKey] ?? 0) || 0
      const catAck = { ...current.catAck, [catKey]: n }
      writeAck(clubId, { fingerprint: summary.fingerprint, catAck })
      setAckTick((x) => x + 1)
    },
    [clubId, summary, counts]
  )

  const toggleSoundMuted = useCallback((e) => {
    e?.stopPropagation?.()
    primeClubNotificationAudio()
    const next = !readSoundMuted()
    writeSoundMuted(next)
    setSoundMuted(next)
  }, [])

  const toggleBackgroundNotify = useCallback(
    async (e) => {
      e?.stopPropagation?.()
      setDesktopDeniedHint(false)

      if (readPushSubscribed() || readDesktopNotify()) {
        if (readPushSubscribed()) {
          try {
            const reg = await navigator.serviceWorker?.ready
            const sub = await reg?.pushManager?.getSubscription()
            if (sub?.endpoint) {
              try {
                await postPushUnsubscribe(sub.endpoint)
              } catch {
                /* ignore */
              }
              await sub.unsubscribe()
            }
          } catch {
            /* ignore */
          }
          writePushSubscribed(false)
          setPushSubscribedState(false)
        }
        writeDesktopNotify(false)
        setDesktopNotify(false)
        return
      }

      if (!canUseDesktopNotifications()) return

      let perm = Notification.permission
      if (perm === 'default') perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setDesktopDeniedHint(true)
        return
      }

      const vapid = await fetchPushVapidPublic()
      if (vapid.ok && vapid.publicKey && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const base = import.meta.env.BASE_URL || '/'
          const swUrl = `${base}sw.js`.replace(/\/{2,}/g, '/')
          const reg = await navigator.serviceWorker.register(swUrl, { scope: base })
          await reg.update()
          const existing = await reg.pushManager.getSubscription()
          if (existing) await existing.unsubscribe()
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
          })
          await postPushSubscribe({
            clubId,
            subscription: sub.toJSON(),
            locale: language === 'ar' ? 'ar' : 'en',
          })
          writePushSubscribed(true)
          setPushSubscribedState(true)
          writeDesktopNotify(false)
          setDesktopNotify(false)
          return
        } catch (err) {
          console.warn('[push] subscribe failed', err)
        }
      }

      writeDesktopNotify(true)
      setDesktopNotify(true)
    },
    [clubId, language]
  )

  useEffect(() => {
    if (!showUi || !summary?.counts) return
    const prev = prevPollCountsRef.current
    const snap = {}
    for (const c of CAT_DEFS) {
      snap[c.key] = Number(counts[c.key] ?? 0) || 0
    }
    if (!prev) {
      prevPollCountsRef.current = snap
      return
    }
    let increasedKey = null
    for (const c of CAT_DEFS) {
      if (snap[c.key] > (prev[c.key] ?? 0)) {
        increasedKey = c.key
        break
      }
    }
    prevPollCountsRef.current = snap
    if (!increasedKey || soundMuted) return

    const usePush = readPushSubscribed()
    const backgrounded = typeof document !== 'undefined' && !document.hasFocus()
    const desktopOk =
      readDesktopNotify() && canUseDesktopNotifications() && Notification.permission === 'granted'

    if (backgrounded && desktopOk && !usePush) {
      const lab = t[increasedKey] || increasedKey
      const n = snap[increasedKey]
      showClubDesktopNotification({
        title: language === 'ar' ? 'إشعار النادي' : 'Club notification',
        body: language === 'ar' ? `${lab}: ${n}` : `${lab}: ${n}`,
        tag: `playtix-${clubId}-${increasedKey}-${Date.now()}`,
      })
    } else if (!backgrounded || !usePush) {
      playNotificationSound(increasedKey)
    }
  }, [summary, counts, showUi, soundMuted, t, language, clubId])

  const goAdmin = useCallback(
    (pathSeg, search = '') => {
      const q = search && !search.startsWith('?') ? `?${search}` : search
      navigate(`/admin/club/${encodeURIComponent(clubId)}/${pathSeg}${q}`)
      setExpanded(false)
    },
    [clubId, navigate]
  )

  const tickerParts = useMemo(() => {
    const parts = []
    for (const c of CAT_DEFS) {
      const n = Number(counts[c.key] ?? 0) || 0
      if (n <= 0) continue
      const u = unreadByCat[c.id]
      if (!tickerStale && !u) continue
      const label = t[c.key] || c.key
      parts.push(`${label}: ${n}`)
    }
    return parts
  }, [counts, unreadByCat, tickerStale, t])

  const grouped = useMemo(() => {
    const g = {}
    for (const c of CAT_DEFS) {
      const gr = c.group
      if (!g[gr]) g[gr] = []
      g[gr].push(c)
    }
    return g
  }, [])

  const groupTitle = (g) => {
    switch (g) {
      case 'bookings':
        return t.groupBookings
      case 'payments':
        return t.groupPayments
      case 'store':
        return t.groupStore
      case 'members':
        return t.groupMembers
      case 'live':
        return t.groupLive
      default:
        return g
    }
  }

  if (!showUi) return null

  const tickerPlacementClass = docked ? 'cn-ticker--bar' : 'cn-ticker--fixed'
  const tickerEl =
    showTicker && tickerParts.length > 0 && (tickerStale || hasUnread) ? (
      <div
        className={`cn-ticker ${tickerPlacementClass} ${reduceMotion ? 'cn-ticker--no-motion' : ''} ${tickerStale ? 'cn-ticker--urgent' : ''}`}
        role="region"
        aria-label={t.hubTitle}
      >
        <div className="cn-ticker__inner">
          <span className="cn-ticker__label">{t.liveNow}</span>
          <div className="cn-ticker__track" aria-live="polite">
            <div className="cn-ticker__marquee">
              {(tickerParts.join(t.tickerSep) + t.tickerSep).repeat(3)}
            </div>
          </div>
          <button
            type="button"
            className="cn-ticker__cta"
            onClick={() => {
              primeClubNotificationAudio()
              setExpanded(true)
            }}
          >
            {t.openFeed}
          </button>
        </div>
      </div>
    ) : null

  const asideClass = `cn-hub ${docked ? 'cn-hub--docked' : ''} ${!docked && tickerEl ? 'cn-hub--has-ticker' : ''} ${language === 'ar' ? 'cn-hub--rtl' : ''} ${expanded ? 'cn-hub--expanded' : ''}`

  const asideEl = (
      <aside
        className={asideClass}
        aria-label={t.hubTitle}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="cn-hub__rail-wrap">
          <button
            type="button"
            className="cn-hub__rail-trigger"
            onClick={() => {
              primeClubNotificationAudio()
              setExpanded((e) => !e)
            }}
            title={t.hubTitle}
            aria-expanded={expanded}
          >
            <span className="cn-hub__rail-bell" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </span>
            <span className="cn-hub__rail-stack">
              {GROUP_ORDER.map((g) => (
                <div key={g} className={`cn-hub__rail-group cn-hub__rail-group--${g}`}>
                  {(grouped[g] || []).map((c) => {
                    const n = Number(counts[c.key] ?? 0) || 0
                    const u = unreadByCat[c.id]
                    const isZero = n <= 0
                    return (
                      <span
                        key={c.id}
                        className={`cn-hub__rail-seg ${isZero ? 'cn-hub__rail-seg--zero' : ''} ${u ? 'cn-hub__rail-seg--unread' : ''} ${reduceMotion ? 'cn-hub__rail-seg--no-blink' : ''}`}
                        style={{ '--cn-color': c.color }}
                      >
                        <span className="cn-hub__rail-seg-icon">
                          <NotificationCategoryIcon id={c.id} size={12} />
                        </span>
                        <span className="cn-hub__rail-seg-num">{n > 99 ? '99+' : String(n)}</span>
                      </span>
                    )
                  })}
                </div>
              ))}
            </span>
          </button>
          <button
            type="button"
            className={`cn-hub__sound-btn ${soundMuted ? 'cn-hub__sound-btn--muted' : ''}`}
            onClick={toggleSoundMuted}
            title={soundMuted ? t.soundUnmuteAria : t.soundMuteAria}
            aria-label={soundMuted ? t.soundUnmuteAria : t.soundMuteAria}
            aria-pressed={soundMuted}
          >
            {soundMuted ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                <path d="m22 9-6 6M16 9l6 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a9 9 0 0 1 0 14.14" />
              </svg>
            )}
          </button>
        </div>

        <div className="cn-hub__drawer">
          <div className="cn-hub__drawer-head">
            <h2 className="cn-hub__title">{t.hubTitle}</h2>
            <div className="cn-hub__drawer-head-actions">
              <button
                type="button"
                className={`cn-hub__drawer-sound ${soundMuted ? 'cn-hub__drawer-sound--muted' : ''}`}
                onClick={toggleSoundMuted}
                title={soundMuted ? t.soundUnmuteAria : t.soundMuteAria}
                aria-label={soundMuted ? t.soundUnmuteAria : t.soundMuteAria}
                aria-pressed={soundMuted}
              >
                {soundMuted ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                    <path d="m22 9-6 6M16 9l6 6" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a9 9 0 0 1 0 14.14" />
                  </svg>
                )}
              </button>
              <button type="button" className="cn-hub__close" onClick={() => setExpanded(false)} aria-label="Close">
                ×
              </button>
            </div>
          </div>
          {err && <p className="cn-hub__err">{err}</p>}
          <div className="cn-hub__body">
            {GROUP_ORDER.map((g) => (
              <div key={g} className={`cn-hub__group cn-hub__group--${g}`}>
                <h3 className="cn-hub__group-title">{groupTitle(g)}</h3>
                <ul className="cn-hub__list">
                  {(grouped[g] || []).map((c) => {
                    const n = Number(counts[c.key] ?? 0) || 0
                    const u = unreadByCat[c.id]
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={`cn-hub__row ${n <= 0 ? 'cn-hub__row--zero' : ''} ${u ? 'cn-hub__row--unread' : ''} ${reduceMotion ? 'cn-hub__row--no-blink' : ''}`}
                          onClick={() => {
                            ackCategoryRead(c.key)
                            if (mode === 'admin') goAdmin(c.adminPath, c.adminSearch || '')
                          }}
                          style={{ '--cn-accent': c.color }}
                        >
                          <span className="cn-hub__badge" style={{ background: c.color }}>
                            <span className="cn-hub__badge-icon" aria-hidden>
                              <NotificationCategoryIcon id={c.id} size={15} />
                            </span>
                            <span className="cn-hub__badge-count">{n > 99 ? '99+' : String(n)}</span>
                          </span>
                          <span className="cn-hub__row-label">{t[c.key] || c.key}</span>
                          {mode === 'admin' ? <span className="cn-hub__chev">›</span> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="cn-hub__foot">
            {canUseDesktopNotifications() ? (
              <div className="cn-hub__desktop-block">
                <button
                  type="button"
                  className={`cn-hub__desktop-toggle ${pushSubscribed ? 'cn-hub__desktop-toggle--push' : ''} ${desktopNotify && !pushSubscribed ? 'cn-hub__desktop-toggle--on' : ''}`}
                  onClick={toggleBackgroundNotify}
                  title={
                    pushSubscribed ? t.desktopPushOn : desktopNotify ? t.desktopPageOn : t.desktopEnableBackground
                  }
                  aria-pressed={pushSubscribed || desktopNotify}
                >
                  {pushSubscribed
                    ? t.desktopPushOn
                    : desktopNotify
                      ? t.desktopPageOn
                      : t.desktopEnableBackground}
                </button>
                <p className="cn-hub__desktop-hint">{t.desktopNotifyHint}</p>
                {desktopDeniedHint ? <p className="cn-hub__desktop-warn">{t.desktopDenied}</p> : null}
              </div>
            ) : null}
            <button type="button" className="cn-hub__mark-read" onClick={markAllRead} disabled={!summary}>
              {t.markRead}
            </button>
          </div>
        </div>
      </aside>
  )

  if (docked) {
    return (
      <div className="cn-admin-shell">
        {tickerEl}
        <div className="cn-admin-shell__row">
          <div className="cn-admin-shell__main">
            {expanded ? (
              <div
                className="cn-hub__backdrop cn-hub__backdrop--docked"
                role="presentation"
                aria-hidden="true"
                onClick={() => setExpanded(false)}
              />
            ) : null}
            {children}
          </div>
          {asideEl}
        </div>
      </div>
    )
  }

  return (
    <>
      {!docked && tickerEl ? <div className="cn-ticker-spacer" aria-hidden="true" /> : null}
      {!docked ? tickerEl : null}

      {expanded ? (
        <div
          className="cn-hub__backdrop"
          role="presentation"
          aria-hidden="true"
          onClick={() => setExpanded(false)}
        />
      ) : null}

      {asideEl}
    </>
  )
}
