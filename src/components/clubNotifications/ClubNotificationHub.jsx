import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchClubNotificationSummary } from '../../api/dbClient'
import './ClubNotificationHub.css'

const POLL_MS = 25000

const CAT_DEFS = [
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

/**
 * @param {{ clubId: string, language: string, mode: 'admin' | 'public', showUi: boolean, showTicker?: boolean, docked?: boolean, children?: import('react').ReactNode }} props
 */
export default function ClubNotificationHub({ clubId, language, mode, showUi, showTicker = true, docked = false, children = null }) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [err, setErr] = useState(null)
  const [ackTick, setAckTick] = useState(0)
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  const pollRef = useRef(null)

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
      if (document.visibilityState === 'visible') load()
    }, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [load, showUi])

  useEffect(() => {
    if (!showUi) return undefined
    const onSync = () => load()
    window.addEventListener('clubs-synced', onSync)
    return () => window.removeEventListener('clubs-synced', onSync)
  }, [load, showUi])

  useEffect(() => {
    if (!expanded) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expanded])

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

  const railUnread = hasUnread || tickerStale
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
          <button type="button" className="cn-ticker__cta" onClick={() => setExpanded(true)}>
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
        <button
          type="button"
          className={`cn-hub__rail ${railUnread ? 'cn-hub__rail--pulse' : ''} ${reduceMotion ? 'cn-hub__rail--no-pulse' : ''}`}
          onClick={() => setExpanded((e) => !e)}
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

        <div className="cn-hub__drawer">
          <div className="cn-hub__drawer-head">
            <h2 className="cn-hub__title">{t.hubTitle}</h2>
            <button type="button" className="cn-hub__close" onClick={() => setExpanded(false)} aria-label="Close">
              ×
            </button>
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
