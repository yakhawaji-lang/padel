import React, { useState, useEffect } from 'react'
import { useAdminPanel } from '../AdminPanelContext'
import { getStore, setStore } from '../../api/dbClient'
import './common.css'
import './PaymentSettingsPage.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)
const PLATFORM_PAYMENT_GATEWAYS_KEY = 'platform_payment_gateways'

const DEFAULT_PAYMENT_GATEWAYS = {
  enabledChannels: { at_club: true, wallet: false, credit_card: false, mada: false, geidea: false, split: true },
  stripe: { publishableKey: '', secretKey: '', webhookSecret: '' },
  mada: { merchantId: '', apiKey: '', gatewayId: '' },
  geidea: { publicKey: '', apiPassword: '', mode: 'test', callbackUrl: '' },
  split: { deadlineMinutes: 30 }
}

const TABS = [
  { key: 'at_club', icon: '\u{1F3E2}', labelEn: 'At club', labelAr: 'الدفع في النادي' },
  { key: 'wallet', icon: '\u{1F45B}', labelEn: 'Member wallet', labelAr: 'محفظة العضو' },
  { key: 'geidea', icon: '⚡', labelEn: 'Electronic payment (Geidea)', labelAr: 'الدفع الإلكتروني (Geidea)' },
  { key: 'credit_card', icon: '\u{1F4B3}', labelEn: 'Credit card (Stripe)', labelAr: 'البطاقة الائتمانية (Stripe)' },
  { key: 'mada', icon: '\u{1F4B3}', labelEn: 'Mada (legacy)', labelAr: 'متاب (قديم)' },
  { key: 'split', icon: '\u{1F465}', labelEn: 'Share with others', labelAr: 'مشاركة الدفع' }
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
          setPaymentGateways(() => ({
            enabledChannels: { ...DEFAULT_PAYMENT_GATEWAYS.enabledChannels, ...(val.enabledChannels || {}) },
            stripe: { ...DEFAULT_PAYMENT_GATEWAYS.stripe, ...(val.stripe || {}) },
            mada: { ...DEFAULT_PAYMENT_GATEWAYS.mada, ...(val.mada || {}) },
            geidea: { ...DEFAULT_PAYMENT_GATEWAYS.geidea, ...(val.geidea || {}) },
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
    setPaymentGateways((prev) => ({
      ...prev,
      enabledChannels: { ...prev.enabledChannels, [key]: !prev.enabledChannels[key] }
    }))
  }

  const updateStripe = (field, value) => {
    setPaymentGateways((prev) => ({ ...prev, stripe: { ...prev.stripe, [field]: value } }))
  }
  const updateMada = (field, value) => {
    setPaymentGateways((prev) => ({ ...prev, mada: { ...prev.mada, [field]: value } }))
  }
  const updateSplit = (field, value) => {
    setPaymentGateways((prev) => ({ ...prev, split: { ...prev.split, [field]: value } }))
  }
  const updateGeidea = (field, value) => {
    setPaymentGateways((prev) => ({ ...prev, geidea: { ...prev.geidea, [field]: value } }))
  }

  const c = {
    title: t('Payment settings', 'إعدادات الدفع', language),
    save: t('Save', 'حفظ', language),
    saving: t('Saving...', 'جاري الحفظ...', language),
    atClubTitle: t('At club', 'الدفع في النادي', language),
    atClubDesc: t('Payment at the club with cash or card.', 'الدفع في النادي نقداً أو بالبطاقة.', language),
    creditCardTitle: t('Credit card (Stripe)', 'البطاقة الائتمانية (Stripe)', language),
    creditCardDesc: t('Online payment via Visa, Mastercard. Requires Stripe account.', 'الدفع أونلاين عبر فيزا وماستركارد. يتطلب حساب Stripe.', language),
    enableGateway: t('Enable this payment method', 'تفعيل طريقة الدفع هذه', language),
    enableSharing: t('Enable payment sharing', 'تفعيل مشاركة الدفع', language),
    publishableKey: t('Publishable key', 'المفتاح العام', language),
    secretKey: t('Secret key', 'المفتاح السري', language),
    webhookSecret: t('Webhook secret', 'سر Webhook', language),
    madaTitle: t('Mada', 'متاب', language),
    madaDesc: t('Saudi Mada card payment. Requires merchant integration.', 'الدفع ببطاقة متاب السعودية. يتطلب تكامل التاجر.', language),
    merchantId: t('Merchant ID', 'معرّف التاجر', language),
    apiKey: t('API Key', 'مفتاح API', language),
    gatewayId: t('Gateway ID', 'معرّف البوابة', language),
    splitTitle: t('Share payment with members', 'مشاركة الدفع مع الأعضاء', language),
    splitDesc: t('Allow members to share the booking cost with others. This is not a payment method - it enables cost sharing.', 'السماح للأعضاء بمشاركة تكلفة الحجز مع الآخرين. هذا ليس خيار دفع بل خيار مشاركة التكلفة.', language),
    deadlineMinutes: t('Deadline (minutes)', 'المهلة (دقائق)', language),
    walletTitle: t('Member wallet balance', 'الدفع من رصيد المحفظة', language),
    walletDesc: t(
      'Lets members pay bookings and fees using club-specific wallet balance (refunds and credits). Clubs can enable wallet only if the platform allows it.',
      'يسمح للأعضاء بدفع الحجوزات والرسوم من رصيد محفظة خاصة بالنادي (استردادات وائتمانات). يمكن للنادي تفعيل المحفظة فقط إذا سمحت المنصة.',
      language
    ),
    geideaTitle: t('Electronic payment - Geidea', 'الدفع الإلكتروني - Geidea', language),
    geideaDesc: t(
      'Unified online checkout via Geidea Checkout V2. The card type (Mada, Visa, Mastercard) is detected automatically. Credentials are stored on the server and never exposed to the browser.',
      'دفع إلكتروني موحّد عبر Geidea Checkout V2. يتم اكتشاف نوع البطاقة (Mada / Visa / Mastercard) تلقائياً. تُحفظ بيانات الاعتماد على الخادم فقط ولا تُكشف في المتصفح.',
      language
    ),
    geideaPublicKey: t('Public key', 'المفتاح العام (Public Key)', language),
    geideaApiPassword: t('API password', 'كلمة مرور API', language),
    geideaMode: t('Environment', 'البيئة', language),
    geideaModeTest: t('Test', 'اختبار', language),
    geideaModeLive: t('Live', 'إنتاج', language),
    geideaCallback: t('Callback URL (server-to-server)', 'رابط الـ Callback (من الخادم إلى الخادم)', language),
    geideaCallbackHint: t(
      'Geidea will POST payment results to this URL. Leave blank to use the default /api/payments/geidea/callback.',
      'سيقوم Geidea بإرسال نتائج الدفع إلى هذا الرابط. اتركه فارغاً لاستخدام /api/payments/geidea/callback الافتراضي.',
      language
    ),
    geideaSecretSet: t('Saved - leave blank to keep current value', 'محفوظ - اتركه فارغاً للإبقاء على القيمة الحالية', language)
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
        <button type="button" className="payment-settings-save-btn" onClick={handleSave} disabled={saving}>
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
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={paymentGateways.enabledChannels?.at_club !== false}
                onChange={() => toggleChannel('at_club')}
                disabled={saving}
              />
              <span>{c.enableGateway}</span>
            </label>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="payment-tab-panel">
            <h2 className="panel-title">{c.walletTitle}</h2>
            <p className="panel-desc">{c.walletDesc}</p>
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={!!paymentGateways.enabledChannels?.wallet}
                onChange={() => toggleChannel('wallet')}
                disabled={saving}
              />
              <span>{c.enableGateway}</span>
            </label>
          </div>
        )}

        {activeTab === 'geidea' && (
          <div className="payment-tab-panel">
            <h2 className="panel-title">{c.geideaTitle}</h2>
            <p className="panel-desc">{c.geideaDesc}</p>
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={!!paymentGateways.enabledChannels?.geidea}
                onChange={() => toggleChannel('geidea')}
                disabled={saving}
              />
              <span>{c.enableGateway}</span>
            </label>
            <div className="payment-form-group">
              <label>{c.geideaPublicKey}</label>
              <input
                type="text"
                value={paymentGateways.geidea?.publicKey || ''}
                onChange={(e) => updateGeidea('publicKey', e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                disabled={saving}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="payment-form-group">
              <label>{c.geideaApiPassword}</label>
              <input
                type="password"
                value={paymentGateways.geidea?.apiPassword || ''}
                onChange={(e) => updateGeidea('apiPassword', e.target.value)}
                placeholder={paymentGateways.geidea?.apiPassword === '••••••••' ? c.geideaSecretSet : '00000000-0000-0000-0000-000000000000'}
                disabled={saving}
                autoComplete="new-password"
                spellCheck={false}
              />
            </div>
            <div className="payment-form-group">
              <label>{c.geideaMode}</label>
              <select
                value={paymentGateways.geidea?.mode || 'test'}
                onChange={(e) => updateGeidea('mode', e.target.value)}
                disabled={saving}
              >
                <option value="test">{c.geideaModeTest}</option>
                <option value="live">{c.geideaModeLive}</option>
              </select>
            </div>
            <div className="payment-form-group">
              <label>{c.geideaCallback}</label>
              <input
                type="url"
                value={paymentGateways.geidea?.callbackUrl || ''}
                onChange={(e) => updateGeidea('callbackUrl', e.target.value)}
                placeholder="https://playtix.app/api/payments/geidea/callback"
                disabled={saving}
                spellCheck={false}
              />
              <small style={{ display: 'block', marginTop: 6, color: 'var(--pt-text-muted, #64748b)' }}>{c.geideaCallbackHint}</small>
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
          <div className="payment-tab-panel payment-tab-panel-split">
            <div className="payment-split-badge">{language === 'ar' ? 'مشاركة التكلفة' : 'Cost sharing'}</div>
            <h2 className="panel-title">{c.splitTitle}</h2>
            <p className="panel-desc">{c.splitDesc}</p>
            <label className="payment-toggle-row">
              <input
                type="checkbox"
                checked={paymentGateways.enabledChannels?.split !== false}
                onChange={() => toggleChannel('split')}
                disabled={saving}
              />
              <span>{c.enableSharing}</span>
            </label>
            <div className="payment-form-group">
              <label>{c.deadlineMinutes}</label>
              <input
     