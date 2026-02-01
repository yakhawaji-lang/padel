import React from 'react'

/**
 * أيقونة اللغة — أعلام تمثل العربية والإنجليزية
 * Language icon — Flags representing Arabic and English
 * @param {string} lang - 'en' | 'ar'
 */
const LanguageIcon = ({ lang, size = 22, className = '' }) => {
  const s = size
  if (lang === 'ar') {
    // علم المملكة العربية السعودية
    return (
      <svg
        className={className}
        width={s}
        height={s * 0.67}
        viewBox="0 0 24 16"
        aria-label="العربية"
      >
        <rect width="24" height="16" fill="#006C35" rx="1" />
      </svg>
    )
  }
  // علم المملكة المتحدة
  return (
    <svg
      className={className}
      width={s}
      height={s * 0.67}
      viewBox="0 0 24 16"
      aria-label="English"
    >
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#fff" strokeWidth="2.5" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.5" />
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="4" />
      <path d="M12 0v16M0 8h24" stroke="#C8102E" strokeWidth="2.5" />
    </svg>
  )
}

export default LanguageIcon
