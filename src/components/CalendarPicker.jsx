import React, { useState, useEffect, useRef } from 'react'
import './CalendarPicker.css'

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']

function toYMD(d) {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromYMD(str) {
  if (!str || typeof str !== 'string') return null
  const [y, m, day] = str.trim().split('-').map(Number)
  if (!y || !m || !day) return null
  const d = new Date(y, m - 1, day)
  if (isNaN(d.getTime())) return null
  return d
}

/** Format YYYY-MM-DD to DD/MM/YYYY with Western numerals only */
function formatDisplay(ymd, language) {
  if (!ymd) return ''
  const d = fromYMD(ymd)
  if (!d) return ymd
  const day = d.getDate()
  const month = d.getMonth() + 1
  const year = d.getFullYear()
  return language === 'ar'
    ? `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
    : `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`
}

function getDaysInMonth(date) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  const firstDay = first.getDay()
  const daysInMonth = last.getDate()
  const cells = []
  const leading = firstDay
  for (let i = 0; i < leading; i++) {
    const prevMonth = new Date(y, m, -leading + i + 1)
    cells.push({ date: prevMonth, currentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(y, m, d), currentMonth: true })
  }
  const remaining = 42 - cells.length
  for (let i = 0; i < remaining; i++) {
    cells.push({ date: new Date(y, m + 1, i + 1), currentMonth: false })
  }
  return cells
}

export default function CalendarPicker({ value, onChange, min, max, language = 'en', className, id, placeholder, 'aria-label': ariaLabel }) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => fromYMD(value) || new Date())
  const inputRef = useRef(null)
  const popoverRef = useRef(null)

  const minDate = fromYMD(min)
  const maxDate = fromYMD(max)
  const valueDate = fromYMD(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    const d = fromYMD(value)
    if (d) setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [value])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const months = language === 'ar' ? MONTHS_AR : MONTHS_EN
  const weekdays = language === 'ar' ? WEEKDAYS_AR : WEEKDAYS_EN

  const cells = getDaysInMonth(viewMonth)

  const isDisabled = (d) => {
    if (!d) return true
    d.setHours(0, 0, 0, 0)
    if (minDate && d < minDate) return true
    if (maxDate && d > maxDate) return true
    return false
  }

  const handleSelect = (d) => {
    if (!d || isDisabled(d)) return
    onChange(toYMD(d))
    setOpen(false)
  }

  const handleToday = () => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    if (!minDate || t >= minDate) {
      onChange(toYMD(t))
      setOpen(false)
    }
  }

  const handleClear = () => {
    onChange('')
    setOpen(false)
  }

  const prevMonth = () => {
    setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }
  const nextMonth = () => {
    setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }

  const isSelected = (d) => valueDate && d && toYMD(d) === toYMD(valueDate)
  const isTodayCell = (d) => d && d.getTime() === today.getTime()

  const t = {
    en: { today: 'Today', clear: 'Clear' },
    ar: { today: 'اليوم', clear: 'محو' }
  }
  const c = t[language] || t.en

  return (
    <div className="calendar-picker-wrap" dir="ltr">
      <div
        ref={inputRef}
        role="button"
        tabIndex={0}
        className={`calendar-picker-input ${className || ''}`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="calendar-picker-icon" aria-hidden>📅</span>
        <span className="calendar-picker-value">
          {value ? formatDisplay(value, language) : (placeholder || (language === 'ar' ? 'اختر التاريخ' : 'Select date'))}
        </span>
      </div>
      {open && (
        <div ref={popoverRef} className="calendar-picker-popover" role="dialog" aria-modal="true" aria-label={language === 'ar' ? 'تقويم' : 'Calendar'}>
          <div className="calendar-picker-header">
            <button type="button" className="calendar-picker-nav" onClick={prevMonth} aria-label={language === 'ar' ? 'الشهر السابق' : 'Previous month'}>
              ‹
            </button>
            <span className="calendar-picker-month-year">
              {months[viewMonth.getMonth()]}, {viewMonth.getFullYear()}
            </span>
            <button type="button" className="calendar-picker-nav" onClick={nextMonth} aria-label={language === 'ar' ? 'الشهر التالي' : 'Next month'}>
              ›
            </button>
          </div>
          <div className="calendar-picker-weekdays">
            {weekdays.map((w, i) => (
              <span key={i} className="calendar-picker-weekday">{w}</span>
            ))}
          </div>
          <div className="calendar-picker-grid">
            {cells.map((cell, i) => {
              const d = cell.date
              const disabled = isDisabled(d)
              const selected = isSelected(d)
              const isToday = isTodayCell(d)
              return (
                <button
                  key={i}
                  type="button"
                  className={`calendar-picker-day ${!cell.currentMonth ? 'other-month' : ''} ${selected ? 'selected' : ''} ${isToday ? 'today' : ''} ${disabled ? 'disabled' : ''}`}
                  disabled={disabled}
                  onClick={() => handleSelect(d)}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
          <div className="calendar-picker-footer">
            <button type="button" className="calendar-picker-action" onClick={handleClear}>{c.clear}</button>
            <button type="button" className="calendar-picker-action" onClick={handleToday}>{c.today}</button>
          </div>
        </div>
      )}
    </div>
  )
}
