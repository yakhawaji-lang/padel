import React from 'react'

/**
 * أيقونة اللغة — تعرض أيقونة مناسبة حسب اللغة المستهدفة
 * Language icon — shows appropriate icon for the target language
 * @param {string} lang - 'en' | 'ar' (the language the icon represents / اللغة التي تمثلها الأيقونة)
 */
const LanguageIcon = ({ lang, size = 22, className = '' }) => {
  if (lang === 'ar') {
    return (
      <span className={className} style={{ fontSize: `${size}px`, fontWeight: 700, fontFamily: 'system-ui, sans-serif' }} aria-hidden>
        ع
      </span>
    )
  }
  return (
    <span className={className} style={{ fontSize: `${size}px`, fontWeight: 700, fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.5px' }} aria-hidden>
      A
    </span>
  )
}

export default LanguageIcon
