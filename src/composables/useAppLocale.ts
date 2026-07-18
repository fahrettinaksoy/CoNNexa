import type { WritableComputedRef } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'

/**
 * Desteklenen diller — tek kayıt defteri.
 * `native`: dilin kendi adı (dil seçicide gösterilir). `rtl`: sağdan-sola yön.
 * Yeni bir dil eklemek: buraya bir satır + `i18n/locales/<code>.ts` + Vuetify'ın
 * `vuetify/locale` paketinden ilgili çeviriyi [i18n/index.ts]'e ekle.
 */
export interface AppLocale {
  code: string
  native: string
  rtl: boolean
}

export const SUPPORTED_LOCALES: readonly AppLocale[] = [
  { code: 'tr', native: 'Türkçe', rtl: false },
  { code: 'en', native: 'English', rtl: false }
]

/**
 * Uygulama dilinin merkezî yönetimi — tek gerçek kaynağı.
 *
 * Dil değişimi tek çağrıyla yayılır:
 *   • vue-i18n (`locale`) → uygulama + Vuetify bileşen metinleri (adaptör sayesinde)
 *   • ayarlar deposu (kalıcılık, localStorage)
 *   • `<html lang>` ve `<html dir>` (erişilebilirlik / doğru yazı yönü)
 *
 * Böylece App.vue ve SettingsView aynı mantığı kopyalamaz.
 */
export function useAppLocale(): {
  current: WritableComputedRef<string>
  locales: readonly AppLocale[]
  apply: (code: string) => void
  formatDate: (value: Date | number, key?: 'short' | 'long') => string
  formatNumber: (value: number, key?: 'decimal' | 'percent') => string
} {
  const { locale, d, n } = useI18n({ useScope: 'global' })
  const settings = useSettingsStore()

  function apply(code: string): void {
    locale.value = code
    settings.locale = code
    const def = SUPPORTED_LOCALES.find((l) => l.code === code)
    document.documentElement.lang = code
    document.documentElement.dir = def?.rtl ? 'rtl' : 'ltr'
  }

  const current = computed<string>({
    get: () => locale.value,
    set: (code) => apply(code)
  })

  const formatDate = (value: Date | number, key: 'short' | 'long' = 'short'): string =>
    d(value, key)
  const formatNumber = (value: number, key: 'decimal' | 'percent' = 'decimal'): string =>
    n(value, key)

  return { current, locales: SUPPORTED_LOCALES, apply, formatDate, formatNumber }
}
