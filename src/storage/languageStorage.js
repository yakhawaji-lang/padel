/**
 * Language storage — appSettingsStorage.
 * Admins sync app/club language to the API; members keep preference in localStorage only.
 */

import { getAppLanguage as getFromDb, setAppLanguage as setToDb, getCached } from './appSettingsStorage.js'

export const getAppLanguage = () => {
  const cached = getCached('app_language')
  if (cached === 'ar' || cached === 'en') return cached
  return 'en'
}

export const setAppLanguage = (lang) => {
  if (lang === 'en' || lang === 'ar') {
    setToDb(lang)
    if (typeof document !== 'undefined') {
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
      document.documentElement.lang = lang
    }
  }
}

export const applyAppLanguage = () => {
  const lang = getAppLanguage()
  if (typeof document !== 'undefined') {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }
  return lang
}
