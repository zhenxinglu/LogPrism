import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './locales/en'
import { zh } from './locales/zh'

const SAVED_LANG_KEY = 'logprism_language'

export const getSavedLanguage = (): 'en' | 'zh' => {
  const saved = localStorage.getItem(SAVED_LANG_KEY)
  if (saved === 'zh' || saved === 'en') {
    return saved
  }
  return 'en'
}

export const setSavedLanguage = (lang: 'en' | 'zh'): void => {
  localStorage.setItem(SAVED_LANG_KEY, lang)
  i18n.changeLanguage(lang)
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh }
  },
  lng: getSavedLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
})

export default i18n
