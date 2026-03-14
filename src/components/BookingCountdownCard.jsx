import React, { useState, useEffect } from 'react'
import './BookingCountdownCard.css'

/** حساب الوقت المتبقي حتى بداية الحجز (بالثواني). تاريخ ووقت محلي. */
function getSecondsUntilStart(dateStr, startTime) {
  if (!dateStr || !startTime) return null
  const [h, m] = String(startTime).trim().split(':').map(Number)
  const start = new Date(dateStr + 'T' + String(h || 0).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0') + ':00')
  const now = new Date()
  const sec = Math.floor((start - now) / 1000)
  return sec
}

/** حالة: قادم | يلعب الآن | انتهى */
function getPlayStatus(dateStr, startTime, endTime) {
  const start = parseDateTime(dateStr, startTime)
  const end = endTime ? parseDateTime(dateStr, endTime) : new Date(start.getTime() + 60 * 60 * 1000)
  const now = new Date()
  if (now < start) return 'upcoming'
  if (now < end) return 'playing'
  return 'ended'
}

function parseDateTime(dateStr, timeStr) {
  const [h, m] = String(timeStr).trim().split(':').map(Number)
  return new Date(dateStr + 'T' + String(h || 0).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0') + ':00')
}

/** يُرجع { d, h, m, s } للعرض في صناديق منفصلة */
function getCountdownParts(seconds) {
  if (seconds == null || seconds < 0) return null
  return {
    d: Math.floor(seconds / 86400),
    h: Math.floor((seconds % 86400) / 3600),
    m: Math.floor((seconds % 3600) / 60),
    s: seconds % 60
  }
}

export default function BookingCountdownCard({ booking, formatDate, language, onClick }) {
  const { dateStr, startTime, endTime, resource, courtName, court, memberName, customerName, customer } = booking
  const courtLabel = resource || courtName || court || '—'
  const customerLabel = memberName || customerName || customer || '—'

  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsUntilStart(dateStr, startTime))
  const status = getPlayStatus(dateStr, startTime, endTime)

  useEffect(() => {
    if (status !== 'upcoming') return
    const tick = () => setSecondsLeft(getSecondsUntilStart(dateStr, startTime))
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [dateStr, startTime, status])

  const t = language === 'ar'
    ? { startsIn: 'يبدأ بعد', playingNow: 'يلعب الآن', over: 'انتهى', day: 'يوم', days: 'أيام', hr: 'س', min: 'د', sec: 'ث' }
    : { startsIn: 'Starts in', playingNow: 'Playing now', over: 'Ended', day: 'Day', days: 'Days', hr: 'Hrs', min: 'Min', sec: 'Sec' }

  const parts = status === 'upcoming' && secondsLeft != null ? getCountdownParts(secondsLeft) : null

  const isClickable = typeof onClick === 'function'
  return (
    <article
      className={`booking-countdown-card booking-countdown-card--${status} ${isClickable ? 'booking-countdown-card--clickable' : ''}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onClick(booking) : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(booking) } } : undefined}
    >
      <div className="booking-countdown-card__accent" aria-hidden />
      <div className="booking-countdown-card__body">
        <div className="booking-countdown-card__main">
          <span className="booking-countdown-card__court-icon" aria-hidden>🏸</span>
          <div className="booking-countdown-card__info">
            <h3 className="booking-countdown-card__court">{courtLabel}</h3>
            <p className="booking-countdown-card__meta">
              <span className="booking-countdown-card__date">{formatDate(dateStr)}</span>
              <span className="booking-countdown-card__time">{startTime}{endTime ? ` – ${endTime}` : ''}</span>
            </p>
            <p className="booking-countdown-card__customer">{customerLabel}</p>
          </div>
        </div>
        <div className="booking-countdown-card__countdown">
          {status === 'upcoming' && parts != null && (
            <>
              <span className="booking-countdown-card__label">{t.startsIn}</span>
              <div className="booking-countdown-card__units" dir="ltr" aria-live="polite">
                {parts.d > 0 && (
                  <div className="booking-countdown-card__unit">
                    <span className="booking-countdown-card__unit-value">{parts.d}</span>
                    <span className="booking-countdown-card__unit-label">{parts.d === 1 ? t.day : t.days}</span>
                  </div>
                )}
                <div className="booking-countdown-card__unit">
                  <span className="booking-countdown-card__unit-value">{String(parts.h).padStart(2, '0')}</span>
                  <span className="booking-countdown-card__unit-label">{t.hr}</span>
                </div>
                <div className="booking-countdown-card__unit">
                  <span className="booking-countdown-card__unit-value">{String(parts.m).padStart(2, '0')}</span>
                  <span className="booking-countdown-card__unit-label">{t.min}</span>
                </div>
                <div className="booking-countdown-card__unit">
                  <span className="booking-countdown-card__unit-value">{String(parts.s).padStart(2, '0')}</span>
                  <span className="booking-countdown-card__unit-label">{t.sec}</span>
                </div>
              </div>
            </>
          )}
          {status === 'playing' && (
            <span className="booking-countdown-card__playing">{t.playingNow}</span>
          )}
          {status === 'ended' && (
            <span className="booking-countdown-card__ended">{t.over}</span>
          )}
        </div>
      </div>
    </article>
  )
}
