import React from 'react'

/**
 * Date input that forces Western numerals (0-9) in the native calendar picker,
 * suitable for both Arabic and English pages. Use lang="en" so the browser
 * renders the calendar with English number script.
 */
const DateInput = ({ value, onChange, min, max, className, id, ...rest }) => (
  <input
    type="date"
    lang="en"
    value={value}
    onChange={onChange}
    min={min}
    max={max}
    className={className}
    id={id}
    {...rest}
  />
)

export default DateInput
