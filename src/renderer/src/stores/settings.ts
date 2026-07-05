import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const locale = ref(localStorage.getItem('connexa:locale') ?? 'tr')
  const theme = ref(localStorage.getItem('connexa:theme') ?? 'system')
  const terminalTheme = ref(localStorage.getItem('connexa:terminalTheme') ?? 'connexa-dark')

  watch(locale, (value) => localStorage.setItem('connexa:locale', value))
  watch(theme, (value) => localStorage.setItem('connexa:theme', value))
  watch(terminalTheme, (value) => localStorage.setItem('connexa:terminalTheme', value))

  return { locale, theme, terminalTheme }
})
