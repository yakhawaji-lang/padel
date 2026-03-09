import React from 'react'
import saudiFlag from '../assets/saudi-flag.png'

/**
 * أيقونة اللغة — علم + العربية أو English
 * Language icon — Flag + label
 * @param {string} lang - 'en' | 'ar'
 */
const LanguageIcon = ({ lang, size = 22, className = '', showLabel = true }) => {
  const s = size
  const label = lang === 'ar' ? 'العربية' : 'English'

  const w = s
  const h = s * 0.67
  const flagEl = lang === 'ar' ? (
    <img src={saudiFlag} alt="" width={w} height={h} style={{ width: w, height: h, objectFit: 'contain', borderRadius: 2 }} aria-hidden />
  ) : (
    /* علم المملكة المتحدة */
    <svg width={w} height={h} viewBox="0 0 24 16" aria-hidden>
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#fff" strokeWidth="2.5" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.5" />
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="4" />
      <path d="M12 0v16M0 8h24" stroke="#C8102E" strokeWidth="2.5" />
    </svg>
  )

  return (
    <span className={`language-icon-wrap ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {flagEl}
      {showLabel && <span className="language-icon-label" style={{ fontSize: size * 0.6, fontWeight: 600 }}>{label}</span>}
    </span>
  )
}

export default LanguageIcon
