import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './club-pages-common.css'
import './ClubBookingPrices.css'
import { getDefaultBookingPrices, calculateBookingPrice } from '../../utils/bookingPricing'

const t = (en, ar, lang) => (lang === 'ar' ? ar : en)

const DAY_LABELS = {
  en: { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' },
  ar: { 0: 'أحد', 1: 'إثنين', 2: 'ثلاثاء', 3: 'أربعاء', 4: 'خميس', 5: 'جمعة', 6: 'سبت' }
}

const ClubBookingPrices = ({ club, language = 'en', onUpdateClub }) => {
  const lang = language || 'en'
  const [activeTab, setActiveTab] = useState('duration')
  const [prices, setPrices] = useState(() => ({
    ...getDefaultBookingPrices(),
    ...(club?.settings?.bookingPrices || {})
  }))
  const [preview, setPreview] = useState({ date: '', time: '18:00', duration: 60 })

  useEffect(() => {
    const bp = club?.settings?.bookingPrices || {}
    setPrices(prev => ({ ...getDefaultBookingPrices(), ...bp }))
  }, [club?.id])

  const handleSave = async () => {
    try {
      await onUpdateClub({
        settings: {
          ...club?.settings,
          bookingPrices: prices
        }
      })
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clubs-synced'))
      alert(t('Pricing saved successfully!', 'تم حفظ الأسعار بنجاح!', lang))
    } catch (err) {
      console.error('Save booking prices failed:', err)
      alert(t('Failed to save. Please try again.', 'فشل الحفظ. يرجى المحاولة مرة أخرى.', lang))
    }
  }

  const addDuration = () => {
    const max = Math.max(0, ...(prices.durationPrices || []).map(d => d.durationMinutes || 0))
    setPrices(prev => ({
      ...prev,
      durationPrices: [...(prev.durationPrices || []), { durationMinutes: max + 30, price: 100 }]
    }))
  }
  const removeDuration = (i) => {
    setPrices(prev => ({
      ...prev,
      durationPrices: (prev.durationPrices || []).filter((_, idx) => idx !== i)
    }))
  }
  const updateDuration = (i, field, val) => {
    setPrices(prev => ({
      ...prev,
      durationPrices: (prev.durationPrices || []).map((d, idx) =>
        idx === i ? { ...d, [field]: field === 'price' ? parseFloat(val) || 0 : parseInt(val, 10) || 0 } : d
      )
    }))
  }

  const addDayModifier = () => {
    setPrices(prev => ({
      ...prev,
      dayModifiers: [...(prev.dayModifiers || []), { days: [0, 1, 2, 3, 4], labelKey: 'weekdays', multiplier: 1 }]
    }))
  }
  const removeDayModifier = (i) => {
    setPrices(prev => ({ ...prev, dayModifiers: (prev.dayModifiers || []).filter((_, idx) => idx !== i) }))
  }
  const toggleDay = (modIdx, day) => {
    setPrices(prev => {
      const mods = [...(prev.dayModifiers || [])]
      const d = mods[modIdx]?.days || []
      const next = d.includes(day) ? d.filter(x => x !== day) : [...d, day].sort((a, b) => a - b)
      mods[modIdx] = { ...mods[modIdx], days: next }
      return { ...prev, dayModifiers: mods }
    })
  }
  const updateDayMult = (i, val) => {
    setPrices(prev => ({
      ...prev,
      dayModifiers: (prev.dayModifiers || []).map((m, idx) =>
        idx === i ? { ...m, multiplier: parseFloat(val) || 1 } : m
      )
    }))
  }

  const addTimeModifier = () => {
    setPrices(prev => ({
      ...prev,
      timeModifiers: [...(prev.timeModifiers || []), { start: '06:00', end: '12:00', labelKey: 'slot', multiplier: 1 }]
    }))
  }
  const removeTimeModifier = (i) => {
    setPrices(prev => ({ ...prev, timeModifiers: (prev.timeModifiers || []).filter((_, idx) => idx !== i) }))
  }
  const updateTimeModifier = (i, field, val) => {
    setPrices(prev => ({
      ...prev,
      timeModifiers: (prev.timeModifiers || []).map((m, idx) =>
        idx === i ? { ...m, [field]: field === 'multiplier' ? parseFloat(val) || 1 : val } : m
      )
    }))
  }

  const addSeasonModifier = () => {
    const y = new Date().getFullYear()
    setPrices(prev => ({
      ...prev,
      seasonModifiers: [...(prev.seasonModifiers || []), { startDate: `${y}-06-01`, endDate: `${y}-08-31`, labelKey: 'season', multiplier: 1.2 }]
    }))
  }
  const removeSeasonModifier = (i) => {
    setPrices(prev => ({ ...prev, seasonModifiers: (prev.seasonModifiers || []).filter((_, idx) => idx !== i) }))
  }
  const updateSeasonModifier = (i, field, val) => {
    setPrices(prev => ({
      ...prev,
      seasonModifiers: (prev.seasonModifiers || []).map((m, idx) =>
        idx === i ? { ...m, [field]: field === 'multiplier' ? parseFloat(val) || 1 : val } : m
      )
    }))
  }

  const currency = club?.settings?.currency || 'SAR'
  const today = new Date().toISOString().split('T')[0]
  const previewDate = preview.date || today
  const clubWithPrices = { ...club, settings: { ...club?.settings, bookingPrices: prices } }
  const previewResult = calculateBookingPrice(clubWithPrices, previewDate, preview.time, preview.duration)

  if (!club) return null

  const tabs = [
    { id: 'duration', label: t('Duration', 'المدة', lang), icon: '⏱️' },
    { id: 'days', label: t('Days', 'الأيام', lang), icon: '📅' },
    { id: 'time', label: t('Time of Day', 'وقت اليوم', lang), icon: '🕐' },
    { id: 'seasons', label: t('Seasons', 'المواسم', lang), icon: '🌤️' }
  ]

  return (
    <div className="club-admin-page">
      <div className="cbp-page">
        <header className="cbp-header">
          <div className="cbp-header-content">
            <h2 className="cbp-title">
              <span className="cbp-icon">💰</span>
              {t('Court Booking Prices', 'أسعار حجوزات الملاعب', lang)}
            </h2>
            <p className="cbp-subtitle">
              {t('Configure pricing by duration, days, time, and seasons', 'إعداد الأسعار حسب المدة والأيام والوقت والمواسم', lang)}
            </p>
          </div>
          <button className="cbp-save-btn" onClick={handleSave}>
            ✓ {t('Save', 'حفظ', lang)}
          </button>
        </header>

        <div className="cbp-tabs">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              className={`cbp-tab ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="cbp-content">
          {activeTab === 'duration' && (
            <section className="cbp-section">
              <h3>{t('Price per duration', 'السعر حسب المدة', lang)}</h3>
              <p className="cbp-hint">{t('Set the base price for each booking duration.', 'حدد السعر الأساسي لكل مدة حجز.', lang)}</p>
              <div className="cbp-table-wrap">
                <table className="cbp-table">
                  <thead>
                    <tr>
                      <th>{t('Duration (min)', 'المدة (دقيقة)', lang)}</th>
                      <th>{t('Price', 'السعر', lang)} ({currency})</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(prices.durationPrices || []).map((d, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            type="number"
                            min={30}
                            step={30}
                            value={d.durationMinutes || 60}
                            onChange={(e) => updateDuration(i, 'durationMinutes', e.target.value)}
                            className="cbp-input cbp-input-num"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={d.price ?? 100}
                            onChange={(e) => updateDuration(i, 'price', e.target.value)}
                            className="cbp-input cbp-input-num"
                          />
                        </td>
                        <td>
                          <button type="button" className="cbp-btn-remove" onClick={() => removeDuration(i)} title={t('Remove', 'إزالة', lang)}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="cbp-btn-add" onClick={addDuration}>
                  + {t('Add duration', 'إضافة مدة', lang)}
                </button>
              </div>
            </section>
          )}

          {activeTab === 'days' && (
            <section className="cbp-section">
              <h3>{t('Day modifiers', 'تعديلات الأيام', lang)}</h3>
              <p className="cbp-hint">{t('Multiplier applied by day of week. 1 = base price, 1.2 = +20%', 'مضاعف حسب يوم الأسبوع. 1 = السعر الأساسي، 1.2 = +20%', lang)}</p>
              {(prices.dayModifiers || []).map((dm, i) => (
                <div key={i} className="cbp-modifier-card">
                  <div className="cbp-modifier-days">
                    {[0, 1, 2, 3, 4, 5, 6].map(day => (
                      <label key={day} className="cbp-day-chip">
                        <input
                          type="checkbox"
                          checked={(dm.days || []).includes(day)}
                          onChange={() => toggleDay(i, day)}
                        />
                        <span>{DAY_LABELS[lang]?.[day] ?? day}</span>
                      </label>
                    ))}
                  </div>
                  <div className="cbp-modifier-mult">
                    <label>{t('Multiplier', 'المضاعف', lang)}</label>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={dm.multiplier ?? 1}
                      onChange={(e) => updateDayMult(i, e.target.value)}
                      className="cbp-input cbp-input-num"
                    />
                  </div>
                  <button type="button" className="cbp-btn-remove" onClick={() => removeDayModifier(i)}>×</button>
                </div>
              ))}
              <button type="button" className="cbp-btn-add" onClick={addDayModifier}>
                + {t('Add day rule', 'إضافة قاعدة أيام', lang)}
              </button>
            </section>
          )}

          {activeTab === 'time' && (
            <section className="cbp-section">
              <h3>{t('Time-of-day modifiers', 'تعديلات وقت اليوم', lang)}</h3>
              <p className="cbp-hint">{t('Different prices for morning, afternoon, evening.', 'أسعار مختلفة للصباح والظهيرة والمساء.', lang)}</p>
              {(prices.timeModifiers || []).map((tm, i) => (
                <div key={i} className="cbp-modifier-card cbp-modifier-row">
                  <div className="cbp-time-range">
                    <input type="time" value={tm.start || '06:00'} onChange={(e) => updateTimeModifier(i, 'start', e.target.value)} className="cbp-input" />
                    <span>–</span>
                    <input type="time" value={tm.end || '12:00'} onChange={(e) => updateTimeModifier(i, 'end', e.target.value)} className="cbp-input" />
                  </div>
                  <div className="cbp-modifier-mult">
                    <label>{t('Multiplier', 'المضاعف', lang)}</label>
                    <input type="number" min={0.1} step={0.1} value={tm.multiplier ?? 1} onChange={(e) => updateTimeModifier(i, 'multiplier', e.target.value)} className="cbp-input cbp-input-num" />
                  </div>
                  <button type="button" className="cbp-btn-remove" onClick={() => removeTimeModifier(i)}>×</button>
                </div>
              ))}
              <button type="button" className="cbp-btn-add" onClick={addTimeModifier}>
                + {t('Add time slot', 'إضافة فترة زمنية', lang)}
              </button>
            </section>
          )}

          {activeTab === 'seasons' && (
            <section className="cbp-section">
              <h3>{t('Season modifiers', 'تعديلات المواسم', lang)}</h3>
              <p className="cbp-hint">{t('Higher or lower prices during specific date ranges.', 'أسعار أعلى أو أقل خلال فترات تاريخية محددة.', lang)}</p>
              {(prices.seasonModifiers || []).map((sm, i) => (
                <div key={i} className="cbp-modifier-card cbp-modifier-row">
                  <div className="cbp-season-range">
                    <input type="date" value={sm.startDate || ''} onChange={(e) => updateSeasonModifier(i, 'startDate', e.target.value)} className="cbp-input" />
                    <span>–</span>
                    <input type="date" value={sm.endDate || ''} onChange={(e) => updateSeasonModifier(i, 'endDate', e.target.value)} className="cbp-input" />
                  </div>
                  <div className="cbp-modifier-mult">
                    <label>{t('Multiplier', 'المضاعف', lang)}</label>
                    <input type="number" min={0.1} step={0.1} value={sm.multiplier ?? 1} onChange={(e) => updateSeasonModifier(i, 'multiplier', e.target.value)} className="cbp-input cbp-input-num" />
                  </div>
                  <button type="button" className="cbp-btn-remove" onClick={() => removeSeasonModifier(i)}>×</button>
                </div>
              ))}
              <button type="button" className="cbp-btn-add" onClick={addSeasonModifier}>
                + {t('Add season', 'إضافة موسم', lang)}
              </button>
            </section>
          )}
        </div>

        <section className="cbp-preview">
          <h3>{t('Price preview', 'معاينة السعر', lang)}</h3>
          <div className="cbp-preview-fields">
            <div>
              <label>{t('Date', 'التاريخ', lang)}</label>
              <input type="date" value={preview.date || today} onChange={(e) => setPreview(p => ({ ...p, date: e.target.value }))} className="cbp-input" min={today} />
            </div>
            <div>
              <label>{t('Start time', 'وقت البداية', lang)}</label>
              <input type="time" value={preview.time} onChange={(e) => setPreview(p => ({ ...p, time: e.target.value }))} className="cbp-input" />
            </div>
            <div>
              <label>{t('Duration', 'المدة', lang)}</label>
              <select value={preview.duration} onChange={(e) => setPreview(p => ({ ...p, duration: parseInt(e.target.value, 10) }))} className="cbp-input">
                {(prices.durationPrices || []).map(d => (
                  <option key={d.durationMinutes} value={d.durationMinutes}>{d.durationMinutes} {t('min', 'دقيقة', lang)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="cbp-preview-result">
            <span className="cbp-preview-label">{t('Total', 'الإجمالي', lang)}:</span>
            <span className="cbp-preview-price">{previewResult.price} {previewResult.currency}</span>
          </div>
        </section>

        <footer className="cbp-footer">
          <Link to={`/club/${club.id}`} className="cbp-footer-link" target="_blank" rel="noopener noreferrer">
            ↗ {t('View pricing on club page', 'عرض الأسعار في صفحة النادي', lang)}
          </Link>
        </footer>
      </div>
    </div>
  )
}

export default ClubBookingPrices
