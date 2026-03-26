import React, { useState, useEffect, useMemo } from 'react'
import { getStore } from '../../api/dbClient'
import { getEffectivePaymentChannels } from '../../utils/paymentChannels'
import './common.css'
import './PaymentSettingsPage.css'
import './ClubPaymentSettingsPage.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)
const PLATFORM_PAYMENT_GATEWAYS_KEY = 'platform_payment_gateways'

const DEFAULT_PLATFORM = {
  enabledChannels: { at_club: true, wallet: false, credit_card: false, mada: false, split: true }
}

const DEFAULT_CLUB = {
  at_club: true,
  wallet: false,
  credit_card: false,
  mada: false,
  split: true
}

const TABS = [
  { key: 'at_club', icon: '🏢', labelEn: 'At club', labelAr: 'الدفع في النادي' },
  { key: 'wallet', icon: '👛', labelEn: 'Member wallet', labelAr: 'محفظة العضو' },
  { key: 'credit_card', icon: '💳', labelEn: 'Credit card', labelAr: 'البطاقة الائتمانية' },
  { key: 'mada', icon: '💳', labelEn: 'Mada', labelAr: 'متاب' },
  { key: 'split', icon: '👥', labelEn: 'Share with others', labelAr: 'مشاركة الدفع' }
]

export default function ClubPaymentSettingsPage({ club, language = 'en', onUpdateClub }) {
  const lang = language || 'en'
  const [activeTab, setActiveTab] = useState('at_club')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageError, setMessageError] = useState(false)
  const [platformGw, setPlatformGw] = useState(() => ({ ...DEFAULT_PLATFORM }))
  const [clubChannels, setClubChannels] = useState(() => ({ ...DEFAULT_CLUB }))

  useEffect(() => {
    getStore(PLATFORM_PAYMENT_GATEWAYS_KEY)
      .then((val) => {
        if (val && typeof val === 'object') {
          setPlatformGw({
            enabledChannels: { ...DEFAULT_PLATFORM.enabledChannels, ...(val.enabledChannels || {}) }
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const c = club?.settings?.paymentEnabledChannels
    if (c && typeof c === 'object' && !Array.isArray(c)) {
      setClubChannels({
        at_club: c.at_club !== false,
        wallet: !!c.wallet,
        credit_card: !!c.credit_card,
        mada: !!c.mada,
        split: c.split !== false
      })
    } else {
      setClubChannels({ ...DEFAULT_CLUB })
    }
  }, [club?.id, club?.settings?.paymentEnabledChannels])

  const effectivePreview = useMemo(
    () => getEffectivePaymentChannels(platformGw.enabledChannels, clubChannels),
    [platformGw.enabledChannels, clubChannels]
  )

  const handleSave = async () => {
    setMessage(null)
    setMessageError(false)
    setSaving(true)
    try {
      await onUpdateClub({
        settings: {
          ...club?.settings,
          paymentEnabledChannels: { ...clubChannels }
        }
      })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      setMessage(t('Saved.', 'تم الحفظ.', lang))
    } catch (err) {
      setMessage(t('Save failed.', 'فشل الحفظ.', lang))
      setMessageError(true)
    } finally {
      setSaving(false)
    }
  }

  const toggleClubChannel = (key) => {
    const plat = platformGw.enabledChannels || {}
    if (key === 'credit_card' && !plat.credit_card) return
    if (key === 'mada' && !plat.mada) return
    if (key === 'at_club' && plat.at_club === false) return
    if (key === 'wallet' && !plat.wallet) return
    if (key === 'split' && plat.split === false) return
    setClubChannels((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const c = {
    title: t('Payment settings (this club)', 'إعدادات الدفع (هذا النادي)', lang),
    save: t('Save', 'حفظ', lang),
    saving: t('Saving...', 'جاري الحفظ...', lang),
    hint: t(
      'Effective options follow the main admin panel: your club can only offer what the platform allows.',
      'الخيارات الفعلية تتبع لوحة التحكم الرئيسية: لا يمكن للنادي تفعيل ما عطّلته المنصة.',
      lang
    ),
    effective: t('Effective for members', 'ما يظهر للأعضاء', lang),
    atClubTitle: t('At club', 'الدفع في النادي', lang),
    atClubDesc: t('Payment at the club with cash or card.', 'الدفع في النادي نقداً أو بالبطاقة.', lang),
    creditCardTitle: t('Credit card (Stripe)', 'البطاقة الائتمانية (Stripe)', lang),
    creditCardDesc: t('Online payment. Requires platform admin to enable Stripe.', 'الدفع الإلكتروني. يتطلب تفعيل Stripe من مدير المنصة.', lang),
    enableForClub: t('Enable for this club', 'تفعيل لهذا النادي', lang),
    platformOff: t('Disabled on platform', 'معطّل على مستوى المنصة', lang),
    madaTitle: t('Mada', 'متاب', lang),
    madaDesc: t('Mada online payment. Requires platform admin to enable it.', 'دفع متاب. يتطلب تفعيله من مدير المنصة.', lang),
    splitTitle: t('Share payment with members', 'مشاركة الدفع مع الأعضاء', lang),
    splitDesc: t('Allow split bookings for this club when the platform allows it.', 'السماح بتقسيم تكلفة الحجز في هذا النادي عندما تسمح المنصة.', lang),
    walletTitle: t('Member wallet balance', 'الدفع من رصيد المحفظة', lang),
    walletDesc: t(
      'Members can pay with wallet balance for this club when the platform enables wallets.',
      'يمكن للأعضاء الدفع من رصيد المحفظة في هذا النادي عندما تفعّل المنصة المحفظة.',
      lang
    )
  }

  if (loading) {
    return (
      <div className="club-admin-page club-payment-settings-page" style={{ padding: 24 }}>
        <p>{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    )
  }

  const plat = platformGw.enabledChannels || {}

  return (
    <div className="club-admin-page club-payment-settings-page main-admin-page payment-settings-page">
      <div className="payment-settings-header">
        <h1 className="main-admin-page-title">{c.title}</h1>
        {message && (
          <p className={`payment-settings-message ${messageError ? 'error' : 'success'}`}>{message}</p>
        )}
        <button type="button" className="payment-settings-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? c.saving : c.save}
        </button>
      </div>

      <p className="club-payment-settings-hint">{c.hint}</p>

      <div className="club-payment-effective-preview" role="status">
        <span className="club-payment-effective-label">{c.effective}:</span>
        <span className="club-payment-effective-tags">
          {effectivePreview.at_club !== false && <span className="tag">{lang === 'ar' ? 'في النادي' : 'At club'}</span>}
          {effectivePreview.wallet && <span className="tag">{lang === 'ar' ? 'محفظة' : 'Wallet'}</span>}
          {effectivePreview.credit_card && <span className="tag">Stripe</span>}
          {effectivePreview.mada && <span className="tag">Mada</span>}
          {effectivePreview.split !== false && <span className="tag">{lang === 'ar' ? 'مشاركة' : 'Split'}</span>}
          {!effectivePreview.at_club && !effectivePreview.credit_card && !effectivePreview.mada && (
            <span className="tag muted">{lang === 'ar' ? 'لا طرق دفع' : 'No methods'}</span>
          )}
        </span>
      </div>

      <div className="payment-settings-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`payment-settings-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{lang === 'ar' ? tab.labelAr : tab.labelEn}</span>
          </button>
        ))}
      </div>

      <div className="payment-settings-content">
        {activeTab === 'at_club' && (
          <div className="payment-tab-panel">
            <h2 className="panel-title">{c.atClubTitle}</h2>
            <p className="panel-desc">{c.atClubDesc}</p>
            {plat.at_club === false && <p className="panel-platform-off">{c.platformOff}</p>}
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={clubChannels.at_club !== false}
                onChange={() => toggleClubChannel('at_club')}
                disabled={saving || plat.at_club === false}
              />
              <span>{c.enableForClub}</span>
            </label>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="payment-tab-panel">
            <h2 className="panel-title">{c.walletTitle}</h2>
            <p className="panel-desc">{c.walletDesc}</p>
            {!plat.wallet && <p className="panel-platform-off">{c.platformOff}</p>}
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={!!clubChannels.wallet}
                onChange={() => toggleClubChannel('wallet')}
                disabled={saving || !plat.wallet}
              />
              <span>{c.enableForClub}</span>
            </label>
          </div>
        )}

        {activeTab === 'credit_card' && (
          <div className="payment-tab-panel">
            <h2 className="panel-title">{c.creditCardTitle}</h2>
            <p className="panel-desc">{c.creditCardDesc}</p>
            {!plat.credit_card && <p className="panel-platform-off">{c.platformOff}</p>}
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={!!clubChannels.credit_card}
                onChange={() => toggleClubChannel('credit_card')}
                disabled={saving || !plat.credit_card}
              />
              <span>{c.enableForClub}</span>
            </label>
          </div>
        )}

        {activeTab === 'mada' && (
          <div className="payment-tab-panel">
            <h2 className="panel-title">{c.madaTitle}</h2>
            <p className="panel-desc">{c.madaDesc}</p>
            {!plat.mada && <p className="panel-platform-off">{c.platformOff}</p>}
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={!!clubChannels.mada}
                onChange={() => toggleClubChannel('mada')}
                disabled={saving || !plat.mada}
              />
              <span>{c.enableForClub}</span>
            </label>
          </div>
        )}

        {activeTab === 'split' && (
          <div className="payment-tab-panel payment-tab-panel-split">
            <div className="payment-split-badge">{lang === 'ar' ? 'مشاركة التكلفة' : 'Cost sharing'}</div>
            <h2 className="panel-title">{c.splitTitle}</h2>
            <p className="panel-desc">{c.splitDesc}</p>
            {plat.split === false && <p className="panel-platform-off">{c.platformOff}</p>}
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={clubChannels.split !== false}
                onChange={() => toggleClubChannel('split')}
                disabled={saving || plat.split === false}
              />
              <span>{c.enableForClub}</span>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
