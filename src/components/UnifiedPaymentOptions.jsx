/**
 * Unified payment UI: at club · electronic (card / Mada) · wallet — same patterns app-wide.
 */
import React, { useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './UnifiedPaymentOptions.css'

export function getUnifiedPaymentCopy(language) {
  const ar = language === 'ar'
  return {
    payAtClub: ar ? 'في النادي' : 'At the club',
    payAtClubDesc: ar ? 'ادفع نقداً أو بالبطاقة عند زيارة النادي.' : 'Pay cash or card when you visit the club.',
    payElectronic: ar ? 'إلكتروني' : 'Electronic',
    payElectronicDesc: ar ? 'بطاقة ائتمان أو مدى عبر الرابط الآمن.' : 'Credit card or Mada via secure checkout.',
    payWallet: ar ? 'محفظتي' : 'My wallet',
    payWalletDesc: ar ? 'يُخصم من رصيد محفظتك في هذا النادي.' : 'Charged from your balance at this club.',
    creditCard: ar ? 'بطاقة' : 'Card',
    mada: ar ? 'مدى' : 'Mada',
    walletBalanceLoading: ar ? 'جاري تحميل الرصيد…' : 'Loading balance…',
    walletAvailable: ar ? 'الرصيد المتاح' : 'Available',
    walletBalanceError: ar ? 'تعذّر تحميل الرصيد.' : 'Could not load balance.',
    walletUnavailableSplit: ar ? 'المحفظة متاحة عند دفع المبلغ كاملاً دون تقسيم.' : 'Wallet is available when you pay the full amount (not split).',
    walletUnavailableTraining: ar ? 'دفع المحفظة غير متاح لجلسات التدريب حالياً.' : 'Wallet payment is not available for coach training yet.',
    walletUnavailableShare: ar ? 'للمشاركين: استخدم في النادي أو الإلكتروني. المحفظة عند الحجز الكامل من صفحة النادي.' : 'For shared payments: use at club or electronic. Wallet applies to full bookings from the club page.',
    walletUnavailableTournament: ar ? 'البطولة: الدفع في النادي أو تأكيد الدفع الإلكتروني فقط.' : 'Tournament: pay at the club or confirm electronic payment.',
    walletDisabledByClub: ar ? 'غير مفعّل في إعدادات النادي أو المنصة.' : 'Disabled in club or platform settings.',
    walletRemainderTitle: ar ? 'الباقي بعد المحفظة' : 'Remainder after wallet',
    payStateWalletUsed: ar ? 'تم استخدام المحفظة لهذا الحجز.' : 'Wallet was used for this booking.',
    payStateWalletHint: ar ? 'للحجز الجديد بالمحفظة استخدم صفحة النادي.' : 'For new wallet bookings, use the club booking page.',
  }
}

function useCopy(language) {
  return useMemo(() => getUnifiedPaymentCopy(language), [language])
}

/**
 * Radio-style picker for club booking modal (and similar).
 * value: 'at_club' | 'wallet' | 'credit_card' | 'mada'
 * walletUnavailable: false | 'split' | 'training'
 */
export function UnifiedPaymentMethodPicker({
  language = 'en',
  channels,
  name = 'paymentMethod',
  value,
  onChange,
  walletBalance = null,
  walletLoading = false,
  walletCurrency = 'SAR',
  walletUnavailable = false,
  className = '',
}) {
  const L = useCopy(language)
  const showAtClub = channels?.at_club !== false
  const showWalletChannel = !!channels?.wallet
  const showCC = !!channels?.credit_card
  const showMada = !!channels?.mada
  const hasElectronic = showCC || showMada

  const isElectronic = value === 'credit_card' || value === 'mada'
  const walletDisabledReason = walletUnavailable
    ? walletUnavailable === 'split'
      ? L.walletUnavailableSplit
      : L.walletUnavailableTraining
    : !showWalletChannel
      ? L.walletDisabledByClub
      : null
  const walletDisabled = !!walletDisabledReason

  const setElectronic = useCallback(
    (m) => {
      if (m === 'credit_card' && showCC) onChange('credit_card')
      else if (m === 'mada' && showMada) onChange('mada')
      else if (showCC) onChange('credit_card')
      else if (showMada) onChange('mada')
    },
    [onChange, showCC, showMada]
  )

  const onElectronicCardClick = useCallback(() => {
    if (!hasElectronic) return
    if (showCC && showMada) {
      if (!isElectronic) setElectronic('credit_card')
    } else {
      setElectronic(showCC ? 'credit_card' : 'mada')
    }
  }, [hasElectronic, showCC, showMada, isElectronic, setElectronic])

  return (
    <div className={`unified-pay-grid ${className}`.trim()}>
      {showAtClub && (
        <label
          className={`unified-pay-card ${value === 'at_club' ? 'unified-pay-card--active' : ''}`}
        >
          <input
            type="radio"
            name={name}
            checked={value === 'at_club'}
            onChange={() => onChange('at_club')}
          />
          {value === 'at_club' ? <span className="unified-pay-card__check" aria-hidden>✓</span> : null}
          <span className="unified-pay-card__icon" aria-hidden>🏢</span>
          <span className="unified-pay-card__title">{L.payAtClub}</span>
          <span className="unified-pay-card__desc">{L.payAtClubDesc}</span>
        </label>
      )}

      {hasElectronic && (
        <div
          role="button"
          tabIndex={0}
          className={`unified-pay-card ${isElectronic ? 'unified-pay-card--active' : ''}`}
          onClick={onElectronicCardClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onElectronicCardClick()
            }
          }}
        >
          {isElectronic ? <span className="unified-pay-card__check" aria-hidden>✓</span> : null}
          <span className="unified-pay-card__icon" aria-hidden>💳</span>
          <span className="unified-pay-card__title">{L.payElectronic}</span>
          <span className="unified-pay-card__desc">{L.payElectronicDesc}</span>
          {showCC && showMada && (
            <div className="unified-pay-electronic-subs" onClick={(e) => e.stopPropagation()}>
              <label>
                <input
                  type="radio"
                  name={`${name}-electronic-sub`}
                  checked={value === 'credit_card'}
                  onChange={() => setElectronic('credit_card')}
                />
                {L.creditCard}
              </label>
              <label>
                <input
                  type="radio"
                  name={`${name}-electronic-sub`}
                  checked={value === 'mada'}
                  onChange={() => setElectronic('mada')}
                />
                {L.mada}
              </label>
            </div>
          )}
        </div>
      )}

      <label
        className={`unified-pay-card ${value === 'wallet' && !walletDisabled ? 'unified-pay-card--active' : ''} ${walletDisabled ? 'unified-pay-card--disabled' : ''}`}
      >
        <input
          type="radio"
          name={name}
          checked={value === 'wallet' && !walletDisabled}
          disabled={walletDisabled}
          onChange={() => !walletDisabled && onChange('wallet')}
        />
        {!walletDisabled ? <span className="unified-pay-card__check" aria-hidden>{value === 'wallet' ? '✓' : ''}</span> : null}
        <span className="unified-pay-card__icon" aria-hidden>👛</span>
        <span className="unified-pay-card__title">{L.payWallet}</span>
        <span className="unified-pay-card__desc">{L.payWalletDesc}</span>
        {walletDisabled ? (
          <span className="unified-pay-card__hint unified-pay-card__hint--warn">{walletDisabledReason}</span>
        ) : walletLoading ? (
          <span className="unified-pay-card__hint">{L.walletBalanceLoading}</span>
        ) : walletBalance !== null ? (
          <span className="unified-pay-card__hint">
            {L.walletAvailable}: {Number(walletBalance || 0).toFixed(2)} {walletCurrency}
          </span>
        ) : (
          <span className="unified-pay-card__hint unified-pay-card__hint--warn">{L.walletBalanceError}</span>
        )}
      </label>
    </div>
  )
}

/** After wallet partial cover: choose remainder channel */
export function UnifiedWalletRemainderPicker({
  language = 'en',
  channels,
  name = 'walletRemainderMethod',
  value,
  onChange,
}) {
  const L = useCopy(language)
  const showAtClub = channels?.at_club !== false
  const showCC = !!channels?.credit_card
  const showMada = !!channels?.mada

  return (
    <div className="unified-pay-remainder">
      <p className="unified-pay-remainder-title">{L.walletRemainderTitle}</p>
      <div className="unified-pay-grid">
        {showAtClub && (
          <label className={`unified-pay-card ${value === 'at_club' ? 'unified-pay-card--active' : ''}`}>
            <input
              type="radio"
              name={name}
              checked={value === 'at_club'}
              onChange={() => onChange('at_club')}
            />
            <span className="unified-pay-card__title">{L.payAtClub}</span>
          </label>
        )}
        {showCC && (
          <label className={`unified-pay-card ${value === 'credit_card' ? 'unified-pay-card--active' : ''}`}>
            <input
              type="radio"
              name={name}
              checked={value === 'credit_card'}
              onChange={() => onChange('credit_card')}
            />
            <span className="unified-pay-card__title">{L.creditCard}</span>
          </label>
        )}
        {showMada && (
          <label className={`unified-pay-card ${value === 'mada' ? 'unified-pay-card--active' : ''}`}>
            <input
              type="radio"
              name={name}
              checked={value === 'mada'}
              onChange={() => onChange('mada')}
            />
            <span className="unified-pay-card__title">{L.mada}</span>
          </label>
        )}
      </div>
    </div>
  )
}

/**
 * Pay-share / pay-invite: three visible options (wallet explained as N/A).
 */
export function UnifiedPaymentActionGrid({
  language = 'en',
  layoutRow = true,
  atClubChosen = false,
  atClubTitle,
  atClubDesc,
  onPayAtClub,
  atClubDisabled = false,
  atClubBusy = false,
  electronicHref,
  electronicOnClick,
  electronicDisabled = false,
  electronicTitle,
  electronicDesc,
  walletHint,
}) {
  const L = useCopy(language)
  const tAt = atClubTitle || L.payAtClub
  const tAtDesc = atClubDesc || L.payAtClubDesc
  const tEl = electronicTitle || L.payElectronic
  const tElDesc = electronicDesc || L.payElectronicDesc
  const wHint = walletHint || L.walletUnavailableShare

  const electronicBody = (
    <>
      <span className="unified-pay-action__icon" aria-hidden>💳</span>
      <span className="unified-pay-action__title">{atClubChosen ? (language === 'ar' ? 'التبديل للإلكتروني' : 'Switch to electronic') : tEl}</span>
      <span className="unified-pay-action__desc">{tElDesc}</span>
    </>
  )

  return (
    <div className={`unified-pay-actions ${layoutRow ? 'unified-pay-actions--row' : ''}`}>
      <button
        type="button"
        className={`unified-pay-action ${atClubChosen ? 'unified-pay-action--chosen' : ''}`}
        onClick={onPayAtClub}
        disabled={atClubDisabled || atClubBusy}
        aria-pressed={atClubChosen}
      >
        <span className="unified-pay-action__icon" aria-hidden>🏢</span>
        {atClubChosen ? <span className="unified-pay-action__title">✓ {tAt}</span> : <span className="unified-pay-action__title">{tAt}</span>}
        <span className="unified-pay-action__desc">{atClubChosen ? (language === 'ar' ? 'يمكنك التبديل للإلكتروني أدناه' : 'You can switch to electronic below') : tAtDesc}</span>
        {atClubBusy && !atClubChosen ? <span className="unified-pay-action__desc">…</span> : null}
      </button>

      {typeof electronicOnClick === 'function' ? (
        <button
          type="button"
          className="unified-pay-action"
          onClick={electronicOnClick}
          disabled={electronicDisabled}
        >
          {electronicBody}
        </button>
      ) : (
        <Link to={electronicHref || '#'} className="unified-pay-action">
          {electronicBody}
        </Link>
      )}

      <div className="unified-pay-action unified-pay-action--disabled" aria-disabled="true">
        <span className="unified-pay-action__icon" aria-hidden>👛</span>
        <span className="unified-pay-action__title">{L.payWallet}</span>
        <span className="unified-pay-action__desc">{wHint}</span>
      </div>
    </div>
  )
}

/**
 * Dropdown / card menu: same three rows (my-bookings, booking detail).
 */
export function UnifiedPaymentMenu({
  language = 'en',
  chosePayAtClub = false,
  onPayAtClub,
  payAtClubDisabled = false,
  electronicHref,
  electronicSubtitle,
  walletSubtitle,
  variant = 'share',
  onElectronicNavigate,
}) {
  const L = useCopy(language)
  const wSub =
    walletSubtitle ||
    (variant === 'tournament' ? L.walletUnavailableTournament : L.walletUnavailableShare)

  return (
    <div className="unified-pay-menu" role="list">
      <button
        type="button"
        role="listitem"
        className={`unified-pay-menu-item ${chosePayAtClub ? 'unified-pay-menu-item--chosen' : ''}`}
        onClick={onPayAtClub}
        disabled={payAtClubDisabled || chosePayAtClub}
        aria-pressed={chosePayAtClub}
      >
        <span className="unified-pay-menu-item__icon" aria-hidden>🏢</span>
        <span className="unified-pay-menu-item__body">
          <span className="unified-pay-menu-item__title">
            {chosePayAtClub ? (language === 'ar' ? '✓ الدفع في النادي' : '✓ Pay at club') : L.payAtClub}
          </span>
          <span className="unified-pay-menu-item__desc">{L.payAtClubDesc}</span>
        </span>
      </button>

      <Link
        role="listitem"
        to={electronicHref}
        className="unified-pay-menu-item"
        onClick={onElectronicNavigate}
      >
        <span className="unified-pay-menu-item__icon" aria-hidden>💳</span>
        <span className="unified-pay-menu-item__body">
          <span className="unified-pay-menu-item__title">{L.payElectronic}</span>
          <span className="unified-pay-menu-item__desc">
            {electronicSubtitle || L.payElectronicDesc}
          </span>
        </span>
      </Link>

      <div role="listitem" className="unified-pay-menu-item unified-pay-menu-item--static">
        <span className="unified-pay-menu-item__icon" aria-hidden>👛</span>
        <span className="unified-pay-menu-item__body">
          <span className="unified-pay-menu-item__title">{L.payWallet}</span>
          <span className="unified-pay-menu-item__desc">{wSub}</span>
        </span>
      </div>
    </div>
  )
}

/** PaymentPage: switch between at-club (info), electronic methods, wallet info */
export function UnifiedPaymentPageMethodStrip({
  language = 'en',
  bookingId,
  currentMethod,
  showWalletSplit = false,
  myBookingsLink = '/my-bookings',
}) {
  const L = useCopy(language)
  const ccActive = currentMethod === 'credit_card'
  const madaActive = currentMethod === 'mada'

  return (
    <div className="unified-pay-method-switch" role="group" aria-label={language === 'ar' ? 'طرق الدفع' : 'Payment methods'}>
      <Link to={myBookingsLink} className="unified-pay-method-pill">
        🏢 {L.payAtClub}
      </Link>
      <Link
        to={`/pay/${bookingId}?method=credit_card`}
        className={`unified-pay-method-pill ${ccActive ? 'unified-pay-method-pill--active' : ''}`}
      >
        💳 {L.creditCard}
      </Link>
      <Link
        to={`/pay/${bookingId}?method=mada`}
        className={`unified-pay-method-pill ${madaActive ? 'unified-pay-method-pill--active' : ''}`}
      >
        💳 {L.mada}
      </Link>
      <span
        className={`unified-pay-method-pill unified-pay-method-pill--disabled`}
        title={showWalletSplit ? L.payStateWalletUsed : L.payStateWalletHint}
      >
        👛 {L.payWallet}
      </span>
    </div>
  )
}
