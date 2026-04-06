import React, { useMemo, useEffect } from 'react'
import { getHalfHourTimeOptions, snapTimeToNearestHalfHourOption } from '../utils/clubWorkingHours'

/**
 * Time chooser with only :00 and :30 (replaces unreliable native `<input type="time" step>` pickers).
 */
export default function HalfHourTimeSelect({
  value,
  onChange,
  min,
  max,
  disabled,
  required,
  className,
  style,
  id,
  name,
  'aria-label': ariaLabel,
}) {
  const options = useMemo(() => getHalfHourTimeOptions(min, max), [min, max])

  useEffect(() => {
    if (disabled || !options.length) return
    if (!options.includes(value)) {
      const fixed = snapTimeToNearestHalfHourOption(value, min, max)
      if (fixed !== value) onChange(fixed)
    }
  }, [value, options, min, max, disabled, onChange])

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
