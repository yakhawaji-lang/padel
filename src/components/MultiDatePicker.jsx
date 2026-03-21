/**
 * Multi-date picker - select multiple dates for coach training slots
 */
import React, { useState } from 'react'
import './MultiDatePicker.css'

function toYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDaysInMonth(date) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  const firstDay = first.getDay()
  const daysInMonth = last.getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) {
    cells.push({ date: null, currentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(y, m, d), currentMonth: true })
  }
  return cells
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const WEEKDAYS_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEKDAYS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']

export default function MultiDatePicker({ selectedDates = [], onToggleDate, minDate, language = 'en', viewingDate, onDateClick, highlightedDates = [] }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const min = minDate ? new Date(minDate + 'T12:00:00') : new Date()
  min.setHours(0, 0, 0, 0)

  const cells = getDaysInMonth(viewMonth)
  const months = language === 'ar' ? MONTHS_AR : MONTHS_EN
  const weekdays = language === 'ar' ? WEEKDAYS_AR : WEEKDAYS_EN

  const prevMonth = () => {
    setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  const nextMonth = () => {
    setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  return (
    <div className="multi-date-picker">
      <div className="multi-date-picker-header">
        <button type="button" onClick={prevMonth} aria-label="Previous month">‹</button>
        <span>{months[viewMonth.getMonth()]} {viewMonth.getFullYear()}</span>
        <button type="button" onClick={nextMonth} aria-label="Next month">›</button>
      </div>
      <div className="multi-date-picker-weekdays">
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="multi-date-picker-grid">
        {cells.map((cell, i) => {
          if (!cell.date) return <div key={i} className="multi-date-picker-cell empty" />
          const ymd = toYMD(cell.date)
          const isPast = cell.date < min
          const isSelected = onDateClick ? (viewingDate === ymd) : selectedDates.includes(ymd)
          const hasHighlight = Array.isArray(highlightedDates) && highlightedDates.includes(ymd)
          const handleClick = () => {
            if (isPast) return
            if (onDateClick) onDateClick(ymd)
            else if (onToggleDate) onToggleDate(ymd)
          }
          return (
            <button
              key={i}
              type="button"
              className={`multi-date-picker-cell ${cell.currentMonth ? 'current' : 'other'} ${isSelected ? 'selected' : ''} ${isPast ? 'past' : ''} ${hasHighlight ? 'has-slots' : ''}`}
              onClick={handleClick}
              disabled={isPast}
            >
              {cell.date.getDate()}
              {hasHighlight && !isSelected && <span className="multi-date-picker-dot" aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
