import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { TERMINAL_THEMES } from '@/composables/terminalThemes'
import { useSettingsStore } from '@/stores/settings'

/** Bir hex rengin algısal olarak koyu olup olmadığı (ITU-R BT.601 luminans). */
function isDarkHex(hex: string | undefined): boolean {
  if (!hex) return true
  let h = hex.replace('#', '')
  // Kısa (#fff) biçimi tam biçime genişlet, aksi halde koyu varsayılana düşerdi.
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  if (h.length < 6) return true
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance < 0.5
}

/**
 * Workbench (terminal oturumu) teması — teknik yüzeylerin sabit teması.
 *
 * Terminaller geleneksel olarak koyudur; kullanıcı açık bir terminal şeması
 * (ör. Solarized Light) seçtiğinde ise açık. Uygulamanın _genel_ teması ne
 * olursa olsun, terminalin **çevresindeki chrome** (dolgu, kenarlıklar, Vue ile
 * çizilen durum metinleri) terminalin açık/koyuluğuyla eşleşmelidir — VS Code'un
 * terminali gibi. Bu composable, aktif terminal şemasının arka plan luminansından
 * hangi Vuetify temasının (`dark`/`light`) uygulanacağını türetir.
 *
 * `<v-theme-provider :theme="workbenchTheme">` ile teknik bölgelere uygulanır.
 *
 * @see https://vuetifyjs.com/en/components/theme-providers/
 */
export function useWorkbenchTheme(): { workbenchTheme: ComputedRef<'dark' | 'light'> } {
  const settings = useSettingsStore()

  const workbenchTheme = computed<'dark' | 'light'>(() => {
    const def = TERMINAL_THEMES.find((t) => t.id === settings.terminalTheme)
    return isDarkHex(def?.theme.background) ? 'dark' : 'light'
  })

  return { workbenchTheme }
}
