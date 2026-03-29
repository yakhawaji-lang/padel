import React, { useState, useEffect } from 'react'
import './club-pages-common.css'
import './ClubBookingPoliciesPage.css'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const MODES = [
  { value: 'none', labelEn: 'Free (no fee)', labelAr: 'مجاني (لا رسوم)' },
  { value: 'percent', labelEn: 'Percentage of booking', labelAr: 'نسبة من قيمة الحجز' },
  { value: 'fixed', labelEn: 'Fixed amount', labelAr: 'مبلغ ثابت' }
]

export default function ClubBookingPoliciesPage({ club, language = 'en', onUpdateClub }) {
  const lang = language || 'en'
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [err, setErr] = useState(false)
  const [freeRescheduleCount, setFreeRescheduleCount] = useState(1)
  const [rescheduleFeeMode, setRescheduleFeeMode] = useState('none')
  const [rescheduleFeeValue, setRescheduleFeeValue] = useState(0)
  const [cancelRefundHoursBefore, setCancelRefundHoursBefore] = useState(24)
  const [cancelFeeMode, setCancelFeeMode] = useState('none')
  const [cancelFeeValue, setCancelFeeValue] = useState(0)

  const [trainUseCustom, setTrainUseCustom] = useState(false)
  const [trainHours, setTrainHours] = useState(24)
  const [trainFeeMode, setTrainFeeMode] = useState('none')
  const [trainFeeValue, setTrainFeeValue] = useState(0)

  const [tournUseCustom, setTournUseCustom] = useState(false)
  const [tournHours, setTournHours] = useState(24)
  const [tournFeeMode, setTournFeeMode] = useState('none')
  const [tournFeeValue, setTournFeeValue] = useState(0)

  useEffect(() => {
    const st = club?.settings || {}
    setFreeRescheduleCount(Number(st.freeRescheduleCount ?? 1) || 1)
    setRescheduleFeeMode(['none', 'percent', 'fixed'].includes(st.rescheduleFeeMode) ? st.rescheduleFeeMode : 'none')
    setRescheduleFeeValue(Number(st.rescheduleFeeValue ?? 0) || 0)
    setCancelRefundHoursBefore(Number(st.cancelRefundHoursBefore ?? 24) || 24)
    setCancelFeeMode(['none', 'percent', 'fixed'].includes(st.cancelFeeMode) ? st.cancelFeeMode : 'none')
    setCancelFeeValue(Number(st.cancelFeeValue ?? 0) || 0)

    const ov = st.cancelPolicyOverrides && typeof st.cancelPolicyOverrides === 'object' ? st.cancelPolicyOverrides : {}
    const tr = ov.training
    const hasTr = tr && typeof tr === 'object' && Object.keys(tr).length > 0
    setTrainUseCustom(!!hasTr)
    setTrainHours(
      hasTr && tr.cancelRefundHoursBefore != null ? Number(tr.cancelRefundHoursBefore) || 0 : Number(st.cancelRefundHoursBefore ?? 24) || 24
    )
    setTrainFeeMode(['none', 'percent', 'fixed'].includes(tr?.cancelFeeMode) ? tr.cancelFeeMode : 'none')
    setTrainFeeValue(tr?.cancelFeeValue != null ? Number(tr.cancelFeeValue) || 0 : 0)

    const tn = ov.tournament
    const hasTn = tn && typeof tn === 'object' && Object.keys(tn).length > 0
    setTournUseCustom(!!hasTn)
    setTournHours(
      hasTn && tn.cancelRefundHoursBefore != null ? Number(tn.cancelRefundHoursBefore) || 0 : Number(st.cancelRefundHoursBefore ?? 24) || 24
    )
    setTournFeeMode(['none', 'percent', 'fixed'].includes(tn?.cancelFeeMode) ? tn.cancelFeeMode : 'none')
    setTournFeeValue(tn?.cancelFeeValue != null ? Number(tn.cancelFeeValue) || 0 : 0)
  }, [
    club?.id,
    club?.settings?.freeRescheduleCount,
    club?.settings?.rescheduleFeeMode,
    club?.settings?.cancelRefundHoursBefore,
    club?.settings?.cancelFeeMode,
    club?.settings?.cancelPolicyOverrides,
  ])

  const c = {
    title: t('Booking change & cancellation', 'تعديل الحجز والإلغاء', lang),
    subtitle: t(
      'Court bookings use the default rules below. You can set separate refund windows and fees for training and tournaments.',
      'حجوزات الملعب تستخدم القواعد الافتراضية أدناه. يمكنك ضبط نافذة ورسوم استرداد منفصلة للتدريب والبطولات.',
      lang
    ),
    save: t('Save', 'حفظ', lang),
    saving: t('Saving…', 'جاري الحفظ…', lang),
    saved: t('Saved.', 'تم الحفظ.', lang),
    fail: t('Save failed.', 'فشل الحفظ.', lang),
    rescheduleCard: t('Reschedule (change time)', 'تغيير موعد الحجز', lang),
    freeCount: t('Free edits before fees', 'عدد التعديلات المجانية قبل الرسوم', lang),
    freeCountHint: t(
      'e.g. 1 = first change is free, then the fee below applies. Training sessions do not use reschedule from the member app.',
      'مثلاً 1 = أول تعديل مجاني، ثم تُطبَّق الرسوم أدناه. حصص التدريب لا تستخدم تغيير الموعد من تطبيق العضو.',
      lang
    ),
    feeMode: t('Fee after free edits', 'رسوم التعديل بعد استنفاد المجاني', lang),
    feeValue: t('Value (%, or fixed in club currency)', 'القيمة (نسبة مئوية، أو مبلغ بعملة النادي)', lang),
    cancelCard: t('Court — cancel & refund (default)', 'الملعب — الإلغاء والاسترداد (الافتراضي)', lang),
    hoursBefore: t('Minimum hours before start', 'أقل عدد ساعات قبل بداية الحجز', lang),
    hoursBeforeHint: t(
      'Applies to court bookings and split-payment shares unless overridden below.',
      'تنطبق على حجز الملعب ومشاركة التقسيم ما لم تُعدَّل في الأقسام أدناه.',
      lang
    ),
    cancelFee: t('Cancellation / refund fee', 'رسوم الإلغاء أو الاسترداد', lang),
    cancelFeeValue: t('Value (%, or fixed)', 'القيمة (نسبة أو مبلغ ثابت)', lang),
    trainCard: t('Training sessions — optional override', 'حصص التدريب — سياسة اختيارية', lang),
    trainCustom: t('Use different rules for coach training bookings', 'استخدام قواعد مختلفة لحجوزات التدريب', lang),
    trainHint: t(
      'When off, training cancellations use the same hours and fees as court bookings.',
      'عند الإيقاف، يطبَّق على التدريب نفس الساعات والرسوم كحجز الملعب.',
      lang
    ),
    tournCard: t('Tournaments — optional override', 'البطولات — سياسة اختيارية', lang),
    tournCustom: t('Use different rules for tournament bookings', 'استخدام قواعد مختلفة لحجوزات البطولة', lang),
    tournHint: t(
      'When off, tournament-related cancellations use the court default. Member self-service for tournaments may still be limited by product rules.',
      'عند الإيقاف، تُستخدم افتراضيات الملعب. قد تبقى بعض خطوات البطولة مقيدة بمنطق المنتج.',
      lang
    ),
    note: t(
      'Wallet refunds are fast when the club confirms; card reversals stay pending until staff marks electronic fulfillment. Split participants choose wallet, cash, or card (if paid online).',
      'استرداد المحفظة سريع عند تأكيد النادي؛ عكس البطاقة يبقى معلّقاً حتى يُحدَّد التنفيذ الإلكتروني. مشاركو التقسيم يختارون محفظة أو كاش أو بطاقة (إن دفعوا إلكترونياً).',
      lang
    ),
    migration: t('DB migrations (run on server if needed):', 'تهجير قاعدة البيانات (على السيرفر عند الحاجة):', lang)
  }

  const handleSave = async () => {
    setMessage(null)
    setErr(false)
    setSaving(true)
    try {
      const cancelPolicyOverrides = { ...(club?.settings?.cancelPolicyOverrides || {}) }
      if (trainUseCustom) {
        cancelPolicyOverrides.training = {
          cancelRefundHoursBefore: Math.max(0, Math.min(2160, parseInt(String(trainHours), 10) || 0)),
          cancelFeeMode: trainFeeMode,
          cancelFeeValue: trainFeeMode === 'none' ? 0 : Math.max(0, Number(trainFeeValue) || 0),
        }
      } else {
        delete cancelPolicyOverrides.training
      }
      if (tournUseCustom) {
        cancelPolicyOverrides.tournament = {
          cancelRefundHoursBefore: Math.max(0, Math.min(2160, parseInt(String(tournHours), 10) || 0)),
          cancelFeeMode: tournFeeMode,
          cancelFeeValue: tournFeeMode === 'none' ? 0 : Math.max(0, Number(tournFeeValue) || 0),
        }
      } else {
        delete cancelPolicyOverrides.tournament
      }

      await onUpdateClub({
        settings: {
          ...club?.settings,
          freeRescheduleCount: Math.max(0, Math.min(100, parseInt(String(freeRescheduleCount), 10) || 0)),
          rescheduleFeeMode,
          rescheduleFeeValue: Math.max(0, Number(rescheduleFeeValue) || 0),
          cancelRefundHoursBefore: Math.max(0, Math.min(2160, parseInt(String(cancelRefundHoursBefore), 10) || 0)),
          cancelFeeMode,
          cancelFeeValue: Math.max(0, Number(cancelFeeValue) || 0),
          cancelPolicyOverrides,
        }
      })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      setMessage(c.saved)
    } catch (e) {
      setMessage(c.fail)
      setErr(true)
    } finally {
      setSaving(false)
    }
  }

  const MIGRATION_WALLET = 'https://raw.githubusercontent.com/yakhawaji-lang/padel/main/server/db/migrations/add-member-wallet-and-booking-policies.sql'
  const MIGRATION_OVERRIDES = 'https://raw.githubusercontent.com/yakhawaji-lang/padel/main/server/db/migrations/add-cancel-policy-overrides.sql'

  return (
    <div className="club-admin-page club-booking-policies-page">
      <header className="cxp-header">
        <div className="cxp-header-title-wrap">
          <h1 className="cxp-title">
            <span className="cxp-title-icon" aria-hidden>✏️</span>
            {c.title}
          </h1>
          <p className="cxp-subtitle">{c.subtitle}</p>
        </div>
        <div className="cxp-header-actions">
          {message && (
            <span className={`cbp-flash ${err ? 'cbp-flash--err' : 'cbp-flash--ok'}`} role="status">
              {message}
            </span>
          )}
          <button type="button" className="cxp-btn cxp-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? c.saving : c.save}
          </button>
        </div>
      </header>

      <div className="cbp-grid">
        <section className="cbp-card">
          <h2 className="cbp-card-title">{c.rescheduleCard}</h2>
          <label className="cbp-field">
            <span className="cbp-label">{c.freeCount}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={freeRescheduleCount}
              onChange={(e) => setFreeRescheduleCount(e.target.value)}
              disabled={saving}
            />
            <span className="cbp-hint">{c.freeCountHint}</span>
          </label>
          <label className="cbp-field">
            <span className="cbp-label">{c.feeMode}</span>
            <select value={rescheduleFeeMode} onChange={(e) => setRescheduleFeeMode(e.target.value)} disabled={saving}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {lang === 'ar' ? m.labelAr : m.labelEn}
                </option>
              ))}
            </select>
          </label>
          {rescheduleFeeMode !== 'none' && (
            <label className="cbp-field">
              <span className="cbp-label">{c.feeValue}</span>
              <input
                type="number"
                min={0}
                step={rescheduleFeeMode === 'percent' ? '0.1' : '0.01'}
                value={rescheduleFeeValue}
                onChange={(e) => setRescheduleFeeValue(e.target.value)}
                disabled={saving}
              />
            </label>
          )}
        </section>

        <section className="cbp-card">
          <h2 className="cbp-card-title">{c.cancelCard}</h2>
          <label className="cbp-field">
            <span className="cbp-label">{c.hoursBefore}</span>
            <input
              type="number"
              min={0}
              max={2160}
              value={cancelRefundHoursBefore}
              onChange={(e) => setCancelRefundHoursBefore(e.target.value)}
              disabled={saving}
            />
            <span className="cbp-hint">{c.hoursBeforeHint}</span>
          </label>
          <label className="cbp-field">
            <span className="cbp-label">{c.cancelFee}</span>
            <select value={cancelFeeMode} onChange={(e) => setCancelFeeMode(e.target.value)} disabled={saving}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {lang === 'ar' ? m.labelAr : m.labelEn}
                </option>
              ))}
            </select>
          </label>
          {cancelFeeMode !== 'none' && (
            <label className="cbp-field">
              <span className="cbp-label">{c.cancelFeeValue}</span>
              <input
                type="number"
                min={0}
                step={cancelFeeMode === 'percent' ? '0.1' : '0.01'}
                value={cancelFeeValue}
                onChange={(e) => setCancelFeeValue(e.target.value)}
                disabled={saving}
              />
            </label>
          )}
        </section>

        <section className="cbp-card cbp-card--wide">
          <h2 className="cbp-card-title">{c.trainCard}</h2>
          <label className="cbp-check">
            <input type="checkbox" checked={trainUseCustom} onChange={(e) => setTrainUseCustom(e.target.checked)} disabled={saving} />
            <span>{c.trainCustom}</span>
          </label>
          <p className="cbp-hint cbp-hint--tight">{c.trainHint}</p>
          {trainUseCustom ? (
            <>
              <label className="cbp-field">
                <span className="cbp-label">{c.hoursBefore}</span>
                <input type="number" min={0} max={2160} value={trainHours} onChange={(e) => setTrainHours(e.target.value)} disabled={saving} />
              </label>
              <label className="cbp-field">
                <span className="cbp-label">{c.cancelFee}</span>
                <select value={trainFeeMode} onChange={(e) => setTrainFeeMode(e.target.value)} disabled={saving}>
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {lang === 'ar' ? m.labelAr : m.labelEn}
                    </option>
                  ))}
                </select>
              </label>
              {trainFeeMode !== 'none' && (
                <label className="cbp-field">
                  <span className="cbp-label">{c.cancelFeeValue}</span>
                  <input
                    type="number"
                    min={0}
                    step={trainFeeMode === 'percent' ? '0.1' : '0.01'}
                    value={trainFeeValue}
                    onChange={(e) => setTrainFeeValue(e.target.value)}
                    disabled={saving}
                  />
                </label>
              )}
            </>
          ) : null}
        </section>

        <section className="cbp-card cbp-card--wide">
          <h2 className="cbp-card-title">{c.tournCard}</h2>
          <label className="cbp-check">
            <input type="checkbox" checked={tournUseCustom} onChange={(e) => setTournUseCustom(e.target.checked)} disabled={saving} />
            <span>{c.tournCustom}</span>
          </label>
          <p className="cbp-hint cbp-hint--tight">{c.tournHint}</p>
          {tournUseCustom ? (
            <>
              <label className="cbp-field">
                <span className="cbp-label">{c.hoursBefore}</span>
                <input type="number" min={0} max={2160} value={tournHours} onChange={(e) => setTournHours(e.target.value)} disabled={saving} />
              </label>
              <label className="cbp-field">
                <span className="cbp-label">{c.cancelFee}</span>
                <select value={tournFeeMode} onChange={(e) => setTournFeeMode(e.target.value)} disabled={saving}>
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {lang === 'ar' ? m.labelAr : m.labelEn}
                    </option>
                  ))}
                </select>
              </label>
              {tournFeeMode !== 'none' && (
                <label className="cbp-field">
                  <span className="cbp-label">{c.cancelFeeValue}</span>
                  <input
                    type="number"
                    min={0}
                    step={tournFeeMode === 'percent' ? '0.1' : '0.01'}
                    value={tournFeeValue}
                    onChange={(e) => setTournFeeValue(e.target.value)}
                    disabled={saving}
                  />
                </label>
              )}
            </>
          ) : null}
        </section>
      </div>

      <p className="cbp-note">{c.note}</p>
      <p className="cbp-migration">
        {c.migration}{' '}
        <a href={MIGRATION_WALLET} target="_blank" rel="noopener noreferrer" className="cbp-migration-link">
          wallet + booking policies
        </a>
        {' · '}
        <a href={MIGRATION_OVERRIDES} target="_blank" rel="noopener noreferrer" className="cbp-migration-link">
          cancel_policy_overrides (JSON)
        </a>
      </p>
    </div>
  )
}
