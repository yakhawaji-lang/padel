import React, { useMemo, useEffect } from 'react'
import {
  getHalfHourTimeOptions,
  getHalfHourTimeOptionsForDate,
  snapTimeToNearestInOptions,
} from '../utils/clubWorkingHours'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Time chooser with only :00 and :30.
 * With `settings` + `isoDate`, options follow club "Seasons & time windows" for that day (same as public booking slots).
 * Otherwise uses optional `min` / `max` (single interval or overnight wrap).
 */
export default function HalfHourTimeSelect({
  value,
  onChange,
  min,
  max,
  /** Club settings object (workingHoursSeasons, etc.) */
  settings,
  /** YYYY-MM-DD — must match the selected booking/tournament date */
  isoDate,
  disabled,
  required,
  className,
  style,
  id,
  name,
  'aria-label': ariaLabel,
}) {
  const options = useMemo(() => {
    if (settings != null && isoDate && ISO_DATE_RE.test(String(isoDate).trim())) {
      return getHalfHourTimeOptionsForDate(settings, String(isoDate).trim())
    }
    return getHalfHourTimeOptions(min, max)
  }, [settings, isoDate, min, max])

  useEffect(() => {
    if (disabled || !options.length) return
    if (options.includes(value)) return
    const fixed = snapTimeToNearestInOptions(value, options)
    if (fixed !== value) onChange(fixed)
  }, [value, options, disabled, onChange])

  const selectValue = options.includes(value) ? value : (options[0] || '00:00')

  return (
    <select
      id={id}
      name={name}
      className={className}
      style={style}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      lang="en"
      value={selectValue}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  )
}
