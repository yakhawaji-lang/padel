import React, { useState, useEffect } from 'react'
import { useAdminPanel } from '../AdminPanelContext'
import { getStore, setStore } from '../../api/dbClient'
import './common.css'
import './PaymentSettingsPage.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)
const PLATFORM_PAYMENT_GATEWAYS_KEY = 'platform_payment_gateways'

const DEFAULT_PAYMENT_GATEWAYS = {
  enabledChannels: { at_club: true, credit_card: false, mada: false, split: true },
  stripe: { publishableKey: '', secretKey: '', webhookSecret: '' },
  mada: { merchantId: '', apiKey: '', gatewayId: '' },
  split: { deadlineMinutes: 30 }
}

const TABS = [
  { key: 'at_club', icon: '🏢', labelEn: 'At club', labelAr: 'الدفع في النادي' },
  { key: 'credit_card', icon: '💳', labelEn: 'Credit card', labelAr: 'البطاقة الائتمانية' },
  { key: 'mada', icon: '💳', labelEn: 'Mada', labelAr: 'متاب' },
  { key: 'split', icon: '👥', labelEn: 'Split payment', labelAr: 'تقسيم المبلغ' }
]

export default function PaymentSettingsPage() {
  const { language = 'en' } = useAdminPanel()
  const [activeTab, setActiveTab] = useState('at_club')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageError, setMessageError] = useState(false)
  const [paymentGateways, setPaymentGateways] = useState(() => ({ ...DEFAULT_PAYMENT_GATEWAYS }))

  useEffect(() => {
    getStore(PLATFORM_PAYMENT_GATEWAYS_KEY)
      .then((val) => {
        if (val && typeof val === 'object') {
          setPaymentGateways((prev) => ({
            enabledChannels: { ...DEFAULT_PAYMENT_GATEWAYS.enabledChannels, ...(val.enabledChannels || {}) },
            stripe: { ...DEFAULT_PAYMENT_GATEWAYS.stripe, ...(val.stripe || {}) },
            mada: { ...DEFAULT_PAYMENT_GATEWAYS.mada, ...(val.mada || {}) },
            split: { ...DEFAULT_PAYMENT_GATEWAYS.split, ...(val.split || {}) }
          }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setMessage(null)
    setMessageError(false)
    setSaving(true)
    try {
      await setStore(PLATFORM_PAYMENT_GATEWAYS_KEY, paymentGateways)
      setMessage(language === 'ar' ? 'تم الحفظ.' : 'Saved.')
    } catch (err) {
      setMessage(language === 'ar' ? 'فشل الحفظ.' : 'Save failed.')
      setMessageError(true)
    } finally {
      setSaving(false)
    }
  }

  const toggleChannel = (key) => {
    if (key === 'at_club') return
    setPaymentGateways((prev) => ({
      ...prev,
      enabledChannels: { ...prev.enabledChannels, [key]: !prev.enabledChannels[key] }
    }))
  }

  const updateStripe = (field, value) => {
    setPaymentGateways((prev) => ({
      ...prev,
      stripe: { ...prev.stripe, [field]: value }
    }))
  }

  const updateMada = (field, value) => {
    setPaymentGateways((prev) => ({
      ...prev,
      mada: { ...prev.mada, [field]: value }
    }))
  }

  const updateSplit = (field, value) => {
    setPaymentGateways((prev) => ({
      ...prev,
      split: { ...prev.split, [field]: value }
    }))
  }

  const c = {
    title: t('Payment settings', 'إعدادات الدفع', language),
    save: t('Save', 'حفظ', language),
    saving: t('Saving...', 'جاري الحفظ...', language),
    atClubTitle: t('At club', 'الدفع في النادي', language),
    atClubDesc: t('Payment at the club with cash or card. Always available.', 'الدفع في النادي نقداً أو بالبطاقة. متاح دائماً.', language),
    creditCardTitle: t('Credit card (Stripe)', 'البطاقة الائتمانية (Stripe)', language),
    creditCardDesc: t('Online payment via Visa, Mastercard. Requires Stripe account.', 'الدفع أونلاين عبر فيزا وماستركارد. يتطلب حساب Stripe.', language),
    enableGateway: t('Enable this payment method', 'تفعيل طريقة الدفع هذه', language),
    publishableKey: t('Publishable key', 'المفتاح العام', language),
    secretKey: t('Secret key', 'المفتاح السري', language),
    webhookSecret: t('Webhook secret', 'سر Webhook', language),
    madaTitle: t('Mada', 'متاب', language),
    madaDesc: t('Saudi Mada card payment. Requires merchant integration.', 'الدفع ببطاقة متاب السعودية. يتطلب تكامل التاجر.', language),
    merchantId: t('Merchant ID', 'معرّف التاجر', language),
    apiKey: t('API Key', 'مفتاح API', language),
    gatewayId: t('Gateway ID', 'معرّف البوابة', language),
    splitTitle: t('Split payment', 'تقسيم المبلغ', language),
    splitDesc: t('Split the booking cost with other participants.', 'تقسيم تكلفة الحجز مع المشاركين الآخرين.', language),
    deadlineMinutes: t('Deadline (minutes)', 'المهلة (دقائق)', language)
  }

  if (loading) {
    return (
      <div className="main-admin-page payment-settings-page" style={{ padding: 24 }}>
        <p>{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    )
  }

  return (
    <div className="main-admin-page payment-settings-page">
      <div className="payment-settings-header">
        <h1 className="main-admin-page-title">{c.title}</h1>
        {message && (
          <p className={`payment-settings-message ${messageError ? 'error' : 'success'}`}>{message}</p>
        )}
        <button
          type="button"
          className="payment-settings-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? c.saving : c.save}
        </button>
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
            <span className="tab-label">{language === 'ar' ? tab.labelAr : tab.labelEn}</span>
          </button>
        ))}
      </div>

      <div className="payment-settings-content">
        {activeTab === 'at_club' && (
          <div className="payment-tab-panel">
            <h2 className="panel-title">{c.atClubTitle}</h2>
            <p className="panel-desc">{c.atClubDesc}</p>
            <div className="payment-info-card">
              <span className="info-icon">✓</span>
              <span>{language === 'ar' ? 'مفعّل دائماً' : 'Always enabled'}</span>
            </div>
          </div>
        )}

        {activeTab === 'credit_card' && (
          <div className="payment-tab-panel">
            <h2 className="panel-title">{c.creditCardTitle}</h2>
            <p className="panel-desc">{c.creditCardDesc}</p>
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={!!paymentGateways.enabledChannels?.credit_card}
                onChange={() => toggleChannel('credit_card')}
                disabled={saving}
              />
              <span>{c.enableGateway}</span>
            </label>
            <div className="payment-form-group">
              <label>{c.publishableKey}</label>
              <input
                type="text"
                value={paymentGateways.stripe?.publishableKey || ''}
                onChange={(e) => updateStripe('publishableKey', e.target.value)}
                placeholder="pk_live_xxx"
                disabled={saving}
              />
            </div>
            <div className="payment-form-group">
              <label>{c.secretKey}</label>
              <input
                type="password"
                value={paymentGateways.stripe?.secretKey || ''}
                onChange={(e) => updateStripe('secretKey', e.target.value)}
                placeholder="sk_live_xxx"
                disabled={saving}
              />
            </div>
            <div className="payment-form-group">
              <label>{c.webhookSecret}</label>
              <input
                type="password"
                value={paymentGateways.stripe?.webhookSecret || ''}
                onChange={(e) => updateStripe('webhookSecret', e.target.value)}
                placeholder="whsec_xxx"
                disabled={saving}
              />
            </div>
          </div>
        )}

        {activeTab === 'mada' && (
          <div className="payment-tab-panel">
            <h2 className="panel-title">{c.madaTitle}</h2>
            <p className="panel-desc">{c.madaDesc}</p>
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={!!paymentGateways.enabledChannels?.mada}
                onChange={() => toggleChannel('mada')}
                disabled={saving}
              />
              <span>{c.enableGateway}</span>
            </label>
            <div className="payment-form-group">
              <label>{c.merchantId}</label>
              <input
                type="text"
                value={paymentGateways.mada?.merchantId || ''}
                onChange={(e) => updateMada('merchantId', e.target.value)}
                placeholder=""
                disabled={saving}
              />
            </div>
            <div className="payment-form-group">
              <label>{c.apiKey}</label>
              <input
                type="password"
                value={paymentGateways.mada?.apiKey || ''}
                onChange={(e) => updateMada('apiKey', e.target.value)}
                placeholder=""
                disabled={saving}
              />
            </div>
            <div className="payment-form-group">
              <label>{c.gatewayId}</label>
              <input
                type="text"
                value={paymentGateways.mada?.gatewayId || ''}
                onChange={(e) => updateMada('gatewayId', e.target.value)}
                placeholder=""
                disabled={saving}
              />
            </div>
          </div>
        )}

        {activeTab === 'split' && (
          <div className="payment-tab-panel">
            <h2 className="panel-title">{c.splitTitle}</h2>
            <p className="panel-desc">{c.splitDesc}</p>
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={paymentGateways.enabledChannels?.split !== false}
                onChange={() => toggleChannel('split')}
                disabled={saving}
              />
              <span>{c.enableGateway}</span>
            </label>
            <div className="payment-form-group">
              <label>{c.deadlineMinutes}</label>
              <input
                type="number"
                min={5}
                max={120}
                value={paymentGateways.split?.deadlineMinutes ?? 30}
                onChange={(e) => updateSplit('deadlineMinutes', parseInt(e.target.value, 10) || 30)}
                disabled={saving}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
