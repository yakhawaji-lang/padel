import React, { useMemo } from 'react'
import { getBookingCalendarKind } from '../utils/bookingCalendarKind'
import { shareHasMemberRefundPending } from '../utils/bookingMemberCancel'
import './ClubCalendarBookingDetailSheet.css'

function bookingJsonData(booking) {
  const d = booking?.data
  if (d && typeof d === 'object') return d
  if (typeof d === 'string') {
    try {
      return JSON.parse(d)
    } catch {
      return {}
    }
  }
  return {}
}

function formatDetailDate(dateRaw, language) {
  const dateStr = (dateRaw || '').toString().split('T')[0]
  if (!dateStr) return '—'
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return dateStr
  }
}

function shareIsPaid(sh) {
  return !!(sh?.paidAt || sh?.paid_at) && !(sh?.refundedAt || sh?.refunded_at)
}

export default function ClubCalendarBookingDetailSheet({
  booking,
  language,
  t,
  currentClub,
  paymentStatus,
  onClose,
  onEditCourtBooking,
  onEditTournamentSchedule,
  onOpenTournament,
  onConfirmSharePaid,
  onConfirmFullPayment,
}) {
  const isRTL = language === 'ar'
  const kind = getBookingCalendarKind(booking)
  const data = bookingJsonData(booking)
  const currency = currentClub?.settings?.currency || 'SAR'

  const typeMeta = useMemo(() => {
    const base = {
      classSuffix: kind.replace(/_/g, '-'),
      label:
        kind === 'court'
          ? t.calendarKindCourt
          : kind === 'training'
            ? t.calendarKindTraining
            : kind === 'tournament_king'
              ? t.calendarKindTournamentKing
              : t.calendarKindTournamentSocial,
      icon: kind === 'tournament_social' ? '👥' : kind === 'tournament_king' ? '🏆' : kind === 'training' ? '🎓' : '🎾',
    }
    return base
  }, [kind, t])

  const isPlaytomic =
    booking?.source === 'playtomic' || booking?.id?.toString().startsWith('playtomic_')

  const customer =
    booking?.memberName || booking?.customerName || booking?.customer || booking?.initiatorName || ''

  const courtLine = useMemo(() => {
    let line = booking?.resource || booking?.courtName || booking?.court || '—'
    if (booking?.isTournament && Array.isArray(booking.tournamentCourtIds) && booking.tournamentCourtIds.length > 0) {
      const courts = currentClub?.courts || []
      const labels = booking.tournamentCourtIds.map((id) => {
        const c = courts.find(
          (co) =>
            String(co.id) === String(id) || String(co.name) === String(id) || String(co.nameAr) === String(id)
        )
        return c ? (language === 'ar' ? c.nameAr || c.name : c.name) : String(id)
      })
      line = labels.join(language === 'ar' ? '، ' : ', ')
    }
    return line
  }, [booking, currentClub?.courts, language])

  const shares = Array.isArray(booking?.paymentShares) ? booking.paymentShares : []
  const totalAmt = parseFloat(booking?.totalAmount ?? booking?.total_amount ?? booking?.amount ?? 0) || 0
  const paidFromShares = shares.reduce((s, sh) => s + (shareIsPaid(sh) ? parseFloat(sh.amount) || 0 : 0), 0)
  const fromDb = parseFloat(booking?.paidAmount ?? booking?.paid_amount ?? 0) || 0
  const collected = Math.max(paidFromShares, fromDb)
  const outstanding = Math.max(0, totalAmt - collected)

  const payBadgeClass =
    paymentStatus === 'paid'
      ? 'ccd-sheet__pay--paid'
      : paymentStatus === 'partially_paid'
        ? 'ccd-sheet__pay--partial'
        : paymentStatus === 'refund_pending'
          ? 'ccd-sheet__pay--refund-pending'
          : 'ccd-sheet__pay--unpaid'

  const payHeaderLabel =
    paymentStatus === 'paid'
      ? t.paid
      : paymentStatus === 'partially_paid'
        ? t.partiallyPaid
        : paymentStatus === 'refund_pending'
          ? (t.calendarPaymentRefundPending || t.calendarDetailRefundPending)
          : t.notPaid

  const trainingExtras = []
  if (kind === 'training') {
    if (data.sessionTitle || data.title) trainingExtras.push({ k: t.calendarDetailTrainingTitle, v: data.sessionTitle || data.title })
    if (data.coachName || data.coach) trainingExtras.push({ k: t.calendarDetailCoach, v: data.coachName || data.coach })
  }

  const durationLabel = booking?.durationMinutes ? `${booking.durationMinutes} ${t.calendarDetailMin}` : null

  return (
    <div
      className="ccd-sheet"
      dir={isRTL ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ccd-sheet-title"
    >
      <button type="button" className="ccd-sheet__backdrop" onClick={onClose} aria-label={t.calendarDetailClose} />
      <div className={`ccd-sheet__panel ccd-sheet__panel--${typeMeta.classSuffix}`} onClick={(e) => e.stopPropagation()}>
        <header className="ccd-sheet__header">
          <div className="ccd-sheet__header-top">
            <span className="ccd-sheet__icon" aria-hidden>
              {typeMeta.icon}
            </span>
            <div className="ccd-sheet__header-text">
              <p className="ccd-sheet__eyebrow">{typeMeta.label}</p>
              <h2 id="ccd-sheet-title" className="ccd-sheet__title">
                {booking?.isTournament ? typeMeta.label : courtLine}
              </h2>
            </div>
            <button type="button" className="ccd-sheet__close" onClick={onClose} aria-label={t.calendarDetailClose}>
              ×
            </button>
          </div>
          {!booking?.isTournament && (
            <div className="ccd-sheet__header-meta">
              <span className={`ccd-sheet__pay-badge ${payBadgeClass}`}>{payHeaderLabel}</span>
              {isPlaytomic ? <span className="ccd-sheet__src-pill">{t.calendarTooltipPlaytomic}</span> : null}
            </div>
          )}
        </header>

        <div className="ccd-sheet__body">
          <section className="ccd-sheet__section">
            <h3 className="ccd-sheet__section-title">{t.calendarTooltipDetailsSection}</h3>
            <dl className="ccd-sheet__dl">
              <div className="ccd-sheet__row">
                <dt>{t.calendarDetailWhen}</dt>
                <dd>
                  {formatDetailDate(booking?.date || booking?.startDate, language)}
                  <span className="ccd-sheet__time">
                    {' '}
                    · {booking?.startTime || '—'} – {booking?.endTime || '—'}
                  </span>
                </dd>
              </div>
              {durationLabel ? (
                <div className="ccd-sheet__row">
                  <dt>{t.calendarDetailDuration}</dt>
                  <dd>{durationLabel}</dd>
                </div>
              ) : null}
              {booking?.isTournament ? (
                <div className="ccd-sheet__row">
                  <dt>{t.calendarTooltipCourts}</dt>
                  <dd>{courtLine}</dd>
                </div>
              ) : (
                <div className="ccd-sheet__row">
                  <dt>{t.court}</dt>
                  <dd>{courtLine}</dd>
                </div>
              )}
              {(customer || booking?.status) && !booking?.isTournament ? (
                <>
                  {customer ? (
                    <div className="ccd-sheet__row">
                      <dt>{t.member}</dt>
                      <dd>{customer}</dd>
                    </div>
                  ) : null}
                  {booking?.status ? (
                    <div className="ccd-sheet__row">
                      <dt>{t.status}</dt>
                      <dd className="ccd-sheet__status">{String(booking.status)}</dd>
                    </div>
                  ) : null}
                </>
              ) : null}
              {trainingExtras.map((row) => (
                <div key={row.k} className="ccd-sheet__row">
                  <dt>{row.k}</dt>
                  <dd>{row.v}</dd>
                </div>
              ))}
              {booking?.notes ? (
                <div className="ccd-sheet__row ccd-sheet__row--block">
                  <dt>{t.calendarDetailNotes}</dt>
                  <dd className="ccd-sheet__notes">{booking.notes}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {(booking?.participants?.length || 0) > 0 && !booking?.isTournament ? (
            <section className="ccd-sheet__section">
              <h3 className="ccd-sheet__section-title">{t.participants}</h3>
              <ul className="ccd-sheet__participants">
                {(booking.participants || []).map((p, idx) => (
                  <li key={idx}>{typeof p === 'object' ? p.name : p}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {!booking?.isTournament && totalAmt > 0.01 ? (
            <section className="ccd-sheet__section ccd-sheet__section--payment">
              <h3 className="ccd-sheet__section-title">{t.calendarTooltipPayment}</h3>
              <div className="ccd-sheet__payment-summary">
                <div className="ccd-sheet__payment-line">
                  <span>{t.totalAmount}</span>
                  <strong>
                    {totalAmt.toFixed(2)} {currency}
                  </strong>
                </div>
                <div className="ccd-sheet__payment-line">
                  <span>{t.calendarTooltipPaidOfTotal}</span>
                  <strong>{collected.toFixed(2)} {currency}</strong>
                </div>
                <div className="ccd-sheet__payment-line ccd-sheet__payment-line--outstanding">
                  <span>{t.calendarTooltipOutstanding}</span>
                  <strong>{outstanding.toFixed(2)} {currency}</strong>
                </div>
              </div>

              {shares.length > 0 ? (
                <>
                  <p className="ccd-sheet__hint">{t.calendarDetailPaymentShares}</p>
                  <ul className="ccd-sheet__shares">
                    {shares.map((sh, idx) => {
                      const refundPending = shareHasMemberRefundPending(sh, booking)
                      const paid = shareIsPaid(sh) && !refundPending
                      const name = sh.memberName || sh.name || `—`
                      const amt = parseFloat(sh.amount) || 0
                      return (
                        <li
                          key={idx}
                          className={`ccd-sheet__share ${refundPending ? 'ccd-sheet__share--refund-pending' : paid ? 'ccd-sheet__share--paid' : ''}`}
                        >
                          <div className="ccd-sheet__share-main">
                            <span className="ccd-sheet__share-name">{name}</span>
                            <span className="ccd-sheet__share-amt">
                              {amt.toFixed(2)} {currency}
                            </span>
                          </div>
                          <div className="ccd-sheet__share-actions">
                            <span
                              className={
                                refundPending
                                  ? 'ccd-sheet__tag ccd-sheet__tag--refund-pending'
                                  : paid
                                    ? 'ccd-sheet__tag ccd-sheet__tag--ok'
                                    : 'ccd-sheet__tag ccd-sheet__tag--due'
                              }
                            >
                              {refundPending
                                ? t.calendarDetailRefundPending || t.calendarDetailDue
                                : paid
                                  ? t.calendarDetailPaid
                                  : t.calendarDetailDue}
                            </span>
                            {!paid && !refundPending && !isPlaytomic ? (
                              <button
                                type="button"
                                className="ccd-sheet__btn ccd-sheet__btn--secondary"
                                onClick={() => onConfirmSharePaid(idx)}
                              >
                                {t.calendarDetailConfirmShare}
                              </button>
                            ) : null}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : null}

              {!isPlaytomic && outstanding > 0.02 ? (
                <button
                  type="button"
                  className="ccd-sheet__btn ccd-sheet__btn--primary"
                  onClick={onConfirmFullPayment}
                >
                  {shares.length > 0 ? t.calendarDetailConfirmAllShares : t.calendarDetailConfirmFull}
                </button>
              ) : null}
            </section>
          ) : null}

          {isPlaytomic ? (
            <p className="ccd-sheet__readonly">{t.calendarDetailPlaytomicReadOnly}</p>
          ) : null}

          {booking?.isTournament ? (
            <p className="ccd-sheet__tournament-hint">{t.calendarDetailTournamentHint}</p>
          ) : null}
        </div>

        <footer className="ccd-sheet__footer">
          {booking?.isTournament ? (
            <>
              <button type="button" className="ccd-sheet__btn ccd-sheet__btn--secondary" onClick={onEditTournamentSchedule}>
                {t.calendarDetailEditSchedule}
              </button>
              <button type="button" className="ccd-sheet__btn ccd-sheet__btn--primary" onClick={onOpenTournament}>
                {t.calendarDetailOpenTournament}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ccd-sheet__btn ccd-sheet__btn--primary"
              onClick={onEditCourtBooking}
              disabled={isPlaytomic}
            >
              {t.calendarDetailEdit}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
