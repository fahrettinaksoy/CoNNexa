import type { ComputedRef, WritableComputedRef } from 'vue'
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { useSettingsStore } from '@/stores/settings'

/**
 * Tema modu — kullanıcının _tercihi_. 'system' OS'i (prefers-color-scheme)
 * canlı takip eder; 'light'/'dark' sabittir.
 */
export type ThemeMode = 'system' | 'light' | 'dark'

export interface ThemeModeOption {
  value: ThemeMode
  icon: string
  labelKey: string
}

/** Dil seçicideki gibi tek kayıt defteri (ikon + i18n etiketi). */
export const THEME_MODES: readonly ThemeModeOption[] = [
  { value: 'system', icon: 'mdi-theme-light-dark', labelKey: 'settings.themeSystem' },
  { value: 'light', icon: 'mdi-weather-sunny', labelKey: 'settings.themeLight' },
  { value: 'dark', icon: 'mdi-weather-night', labelKey: 'settings.themeDark' }
]

/**
 * Uygulama temasının merkezî yönetimi — tek gerçek kaynağı.
 *
 * Mod değişimi tek çağrıyla yayılır:
 *   • Vuetify tema motoru (`theme.change`) — 'system' modunda OS'i canlı takip
 *   • ayarlar deposu (kalıcılık, localStorage)
 *
 * `isDark`/`resolvedName` çözülmüş (gerçekte uygulanan) temayı verir; 'system'
 * seçiliyken bile bileşenler "şu an koyu mu?" sorusunu buradan yanıtlar.
 */
export function useAppTheme(): {
  mode: WritableComputedRef<ThemeMode>
  modes: readonly ThemeModeOption[]
  isDark: ComputedRef<boolean>
  resolvedName: ComputedRef<string>
  isSystem: ComputedRef<boolean>
  apply: (mode: string) => void
} {
  const theme = useTheme()
  const settings = useSettingsStore()

  /** localStorage bozulsa bile geçerli bir moda düşer. */
  function sanitize(value: string): ThemeMode {
    return THEME_MODES.some((m) => m.value === value) ? (value as ThemeMode) : 'system'
  }

  function apply(mode: string): void {
    const safe = sanitize(mode)
    theme.change(safe)
    settings.theme = safe
  }

  const mode = computed<ThemeMode>({
    get: () => sanitize(settings.theme),
    set: (value) => apply(value)
  })

  const isDark = computed(() => theme.current.value.dark)
  const resolvedName = computed(() => theme.name.value)
  const isSystem = computed(() => theme.isSystem.value)

  return { mode, modes: THEME_MODES, isDark, resolvedName, isSystem, apply }
}
