import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchClubNotificationSummary } from '../../api/dbClient'
import './ClubNotificationHub.css'

const POLL_MS = 25000

const CAT_DEFS = [
  { id: 'locksActive', key: 'locksActive', group: 'bookings', color: '#0284c7', adminPath: 'bookings' },
  { id: 'bookingCompleteFlow', key: 'bookingCompleteFlow', group: 'bookings', color: '#7c3aed', adminPath: 'bookings' },
  { id: 'bookingAwaitingPayments', key: 'bookingAwaitingPayments', group: 'bookings', color: '#d97706', adminPath: 'bookings' },
  { id: 'bookingExpiredWithPayment', key: 'bookingExpiredWithPayment', group: 'bookings', color: '#dc2626', adminPath: 'bookings' },
  { id: 'refundRequests', key: 'refundRequests', group: 'payments', color: '#db2777', adminPath: 'accounting' },
  { id: 'storeSalesRecent', key: 'storeSalesRecent', group: 'store', color: '#059669', adminPath: 'store' },
  { id: 'storeLowStock', key: 'storeLowStock', group: 'store', color: '#ea580c', adminPath: 'store' },
  { id: 'newMembers', key: 'newMembers', group: 'members', color: '#4f46e5', adminPath: 'members' },
  { id: 'viewers', key: 'viewers', group: 'live', color: '#0d9488', adminPath: 'dashboard' },
]

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
 * @param {{ clubId: string, language: string, mode: 'admin' | 'public', showUi: boolean }} props
 */
export default function ClubNotificationHub({ clubId, language, mode, showUi }) {
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
    (pathSeg) => {
      navigate(`/admin/club/${encodeURIComponent(clubId)}/${pathSeg}`)
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
  const tickerEl =
    tickerParts.length > 0 && (tickerStale || hasUnread) ? (
        <div
          className={`cn-ticker cn-ticker--fixed ${reduceMotion ? 'cn-ticker--no-motion' : ''} ${tickerStale ? 'cn-ticker--urgent' : ''}`}
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

  return (
    <>
      {tickerEl ? <div className="cn-ticker-spacer" aria-hidden="true" /> : null}
      {tickerEl}

      <aside
        className={`cn-hub ${tickerEl ? 'cn-hub--has-ticker' : ''} ${language === 'ar' ? 'cn-hub--rtl' : ''} ${expanded ? 'cn-hub--expanded' : ''}`}
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
          {CAT_DEFS.map((c) => {
            const n = Number(counts[c.key] ?? 0) || 0
            if (n <= 0) return null
            const u = unreadByCat[c.id]
            return (
              <span
                key={c.id}
                className={`cn-hub__rail-seg ${u ? 'cn-hub__rail-seg--unread' : ''} ${reduceMotion ? 'cn-hub__rail-seg--no-blink' : ''}`}
                style={{ '--cn-color': c.color }}
                data-count={n > 99 ? '99+' : n}
              />
            )
          })}
          {CAT_DEFS.every((c) => !Number(counts[c.key] ?? 0)) && (
            <span className="cn-hub__rail-seg cn-hub__rail-seg--empty" style={{ '--cn-color': '#94a3b8' }} data-count="0" />
          )}
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
            {['bookings', 'payments', 'store', 'members', 'live'].map((g) => (
              <div key={g} className="cn-hub__group">
                <h3 className="cn-hub__group-title">{groupTitle(g)}</h3>
                <ul className="cn-hub__list">
                  {(grouped[g] || []).map((c) => {
                    const n = Number(counts[c.key] ?? 0) || 0
                    const u = unreadByCat[c.id]
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={`cn-hub__row ${u ? 'cn-hub__row--unread' : ''} ${reduceMotion ? 'cn-hub__row--no-blink' : ''}`}
                          onClick={() => {
                            if (mode === 'admin') goAdmin(c.adminPath)
                          }}
                          style={{ '--cn-accent': c.color }}
                        >
                          <span className="cn-hub__badge" style={{ background: c.color }}>
                            {n > 99 ? '99+' : n}
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
    </>
  )
}
