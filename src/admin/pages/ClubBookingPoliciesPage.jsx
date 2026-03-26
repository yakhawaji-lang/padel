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

  useEffect(() => {
    const st = club?.settings || {}
    setFreeRescheduleCount(Number(st.freeRescheduleCount ?? 1) || 1)
    setRescheduleFeeMode(['none', 'percent', 'fixed'].includes(st.rescheduleFeeMode) ? st.rescheduleFeeMode : 'none')
    setRescheduleFeeValue(Number(st.rescheduleFeeValue ?? 0) || 0)
    setCancelRefundHoursBefore(Number(st.cancelRefundHoursBefore ?? 24) || 24)
    setCancelFeeMode(['none', 'percent', 'fixed'].includes(st.cancelFeeMode) ? st.cancelFeeMode : 'none')
    setCancelFeeValue(Number(st.cancelFeeValue ?? 0) || 0)
  }, [club?.id, club?.settings?.freeRescheduleCount, club?.settings?.rescheduleFeeMode, club?.settings?.cancelRefundHoursBefore, club?.settings?.cancelFeeMode])

  const c = {
    title: t('Booking change & cancellation', 'تعديل الحجز والإلغاء', lang),
    subtitle: t(
      'Rules for member self-service: first free edits, then fees; cancel/refund window and fees.',
      'قواعد تعديل وإلغاء الحجز من قبل العضو: التعديلات المجانية ثم الرسوم؛ نافذة الإلغاء والاسترداد والرسوم.',
      lang
    ),
    save: t('Save', 'حفظ', lang),
    saving: t('Saving…', 'جاري الحفظ…', lang),
    saved: t('Saved.', 'تم الحفظ.', lang),
    fail: t('Save failed.', 'فشل الحفظ.', lang),
    rescheduleCard: t('Reschedule (change time)', 'تغيير موعد الحجز', lang),
    freeCount: t('Free edits before fees', 'عدد التعديلات المجانية قبل الرسوم', lang),
    freeCountHint: t(
      'e.g. 1 = first change is free, then the fee below applies.',
      'مثلاً 1 = أول تعديل مجاني، ثم تُطبَّق الرسوم أدناه.',
      lang
    ),
    feeMode: t('Fee after free edits', 'رسوم التعديل بعد استنفاد المجاني', lang),
    feeValue: t('Value (%, or fixed in club currency)', 'القيمة (نسبة مئوية، أو مبلغ بعملة النادي)', lang),
    cancelCard: t('Cancel & refund', 'الإلغاء والاسترداد', lang),
    hoursBefore: t('Minimum hours before start', 'أقل عدد ساعات قبل بداية الحجز', lang),
    hoursBeforeHint: t(
      'Members may cancel and request a refund only if this many hours remain before the booking starts.',
      'يستطيع العضو الإلغاء وطلب الاسترداد فقط إذا بقيت على الأقل هذه الساعات قبل بداية الحجز.',
      lang
    ),
    cancelFee: t('Cancellation / refund fee', 'رسوم الإلغاء أو الاسترداد', lang),
    cancelFeeValue: t('Value (%, or fixed)', 'القيمة (نسبة أو مبلغ ثابت)', lang),
    note: t(
      'Refund to wallet is instant when enabled; original payment refunds are created as pending for club processing.',
      'الاسترداد للمحفظة فوري عند التفعيل؛ طلب الاسترداد للدفع الأصلي يُسجَّل كمعلّق لمعالجة النادي.',
      lang
    ),
    migration: t(
      'DB migration (run once on the server):',
      'تهجير قاعدة البيانات (مرة واحدة على السيرفر):',
      lang
    )
  }

  const handleSave = async () => {
    setMessage(null)
    setErr(false)
    setSaving(true)
    try {
      await onUpdateClub({
        settings: {
          ...club?.settings,
          freeRescheduleCount: Math.max(0, Math.min(100, parseInt(String(freeRescheduleCount), 10) || 0)),
          rescheduleFeeMode,
          rescheduleFeeValue: Math.max(0, Number(rescheduleFeeValue) || 0),
          cancelRefundHoursBefore: Math.max(0, Math.min(2160, parseInt(String(cancelRefundHoursBefore), 10) || 0)),
          cancelFeeMode,
          cancelFeeValue: Math.max(0, Number(cancelFeeValue) || 0)
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

  const MIGRATION_RAW =
    'https://raw.githubusercontent.com/yakhawaji-lang/padel/main/server/db/migrations/add-member-wallet-and-booking-policies.sql'

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
      </div>

      <p className="cbp-note">{c.note}</p>
      <p className="cbp-migration">
        {c.migration}{' '}
        <a href={MIGRATION_RAW} target="_blank" rel="noopener noreferrer" className="cbp-migration-link">
          {MIGRATION_RAW}
        </a>
      </p>
    </div>
  )
}
