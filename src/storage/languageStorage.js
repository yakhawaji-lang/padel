/**
 * تخزين اللغة الموحدة للمشروع
 * Language persistence across the entire project
 */
const APP_LANGUAGE_KEY = 'app_language'

export const getAppLanguage = () => {
  return localStorage.getItem(APP_LANGUAGE_KEY) || 'en'
}

export const setAppLanguage = (lang) => {
  if (lang === 'en' || lang === 'ar') {
    localStorage.setItem(APP_LANGUAGE_KEY, lang)
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }
}

export const applyAppLanguage = () => {
  const lang = getAppLanguage()
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
  return lang
}
