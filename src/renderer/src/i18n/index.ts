import { createI18n } from 'vue-i18n'
import tr from './locales/tr'
import en from './locales/en'

export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('connexa:locale') ?? 'tr',
  fallbackLocale: 'en',
  messages: { tr, en }
})
