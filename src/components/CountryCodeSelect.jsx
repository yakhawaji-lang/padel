/**
 * Professional country code selector with search.
 * Search works in both Arabic and English regardless of app language.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { COUNTRY_CODES, DEFAULT_COUNTRY, getFilteredCountries, getHighlightParts } from '../utils/countryCodes'
import './CountryCodeSelect.css'

export default function CountryCodeSelect({ value, onChange, language = 'en', placeholder, className = '' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const selected = COUNTRY_CODES.find(c => c.code === value) || DEFAULT_COUNTRY
  const filtered = getFilteredCountries(search, language)

  const displayValue = open ? search : `+${selected.code}`

  useEffect(() => {
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setHighlightIndex(-1)
      }
    }
    if (open) {
      document.addEventListener('click', close)
      return () => document.removeEventListener('click', close)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setSearch('')
      setHighlightIndex(-1)
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current?.children[highlightIndex]) {
      listRef.current.children[highlightIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [highlightIndex])

  const handleKeyDown = useCallback((e) => {
    if (!open) return
    if (e.key === 'Escape') {
      setOpen(false)
      setHighlightIndex(-1)
      e.preventDefault()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => Math.min(i + 1, filtered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault()
      const c = filtered[highlightIndex >= 0 ? highlightIndex : 0]
      if (c) {
        onChange(c.code)
        setOpen(false)
        setSearch('')
        setHighlightIndex(-1)
      }
    }
  }, [open, filtered, highlightIndex, onChange])

  const selectCountry = (c) => {
    onChange(c.code)
    setOpen(false)
    setSearch('')
    setHighlightIndex(-1)
  }

  const t = (en, ar) => (language === 'ar' ? ar : en)

  return (
    <div className={`country-code-select ${className}`} ref={wrapRef}>
      <div
        className="country-code-select-trigger"
        onClick={() => setOpen(true)}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="country-code-list"
        aria-label={t('Country code', 'مفتاح الدولة')}
      >
        <span className="country-code-select-flag">{selected.flag}</span>
        <input
          ref={inputRef}
          type="text"
          className="country-code-select-input"
          value={displayValue}
          onChange={(e) => {
            setSearch(e.target.value)
            setHighlightIndex(-1)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || (language === 'ar' ? 'ابحث: السعودية، Egypt، 966...' : 'Search: Saudi Arabia, Egypt, 966...')}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls="country-code-list"
          aria-activedescendant={highlightIndex >= 0 && filtered[highlightIndex] ? `country-${filtered[highlightIndex].code}` : undefined}
        />
        <span className="country-code-select-chevron">▾</span>
      </div>

      {open && (
        <div className="country-code-select-dropdown" id="country-code-list" role="listbox">
          <ul ref={listRef} className="country-code-select-list">
            {filtered.length === 0 ? (
              <li className="country-code-select-empty">
                {t('No country found', 'لا توجد دولة مطابقة')}
              </li>
            ) : (
              filtered.map((c, idx) => {
                const labelAr = c.label || ''
                const labelEn = c.labelEn || ''
                const labelDisplay = language === 'ar'
                  ? `${labelAr}${labelEn ? ` ${labelEn}` : ''}`
                  : `${labelEn}${labelAr ? ` ${labelAr}` : ''}`
                const highlightAr = getHighlightParts(labelAr, search)
                const highlightEn = getHighlightParts(labelEn, search)
                return (
                  <li
                    key={c.code}
                    id={`country-${c.code}`}
                    role="option"
                    aria-selected={c.code === value}
                    className={`country-code-select-option ${c.code === value ? 'selected' : ''} ${idx === highlightIndex ? 'highlighted' : ''}`}
                    onClick={() => selectCountry(c)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                  >
                    <span className="country-code-select-option-flag">{c.flag}</span>
                    <span className="country-code-select-option-code">+{c.code}</span>
                    <span className="country-code-select-option-label">
                      {search.trim() && (highlightAr.length > 1 || highlightEn.length > 1) ? (
                        <span>
                          {language === 'ar' ? (
                            <>
                              {highlightAr.length > 1 ? highlightAr.map((p, i) => i % 2 === 1 ? <mark key={i}>{p}</mark> : p) : labelAr}
                              {labelEn && <span className="country-code-select-option-label-en"> {labelEn}</span>}
                            </>
                          ) : (
                            <>
                              {highlightEn.length > 1 ? highlightEn.map((p, i) => i % 2 === 1 ? <mark key={i}>{p}</mark> : p) : labelEn}
                              {labelAr && <span className="country-code-select-option-label-ar"> {labelAr}</span>}
                            </>
                          )}
                        </span>
                      ) : (
                        labelDisplay
                      )}
                    </span>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
