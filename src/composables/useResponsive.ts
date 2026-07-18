import { computed, type ComputedRef } from 'vue'
import { useDisplay } from 'vuetify'

type Display = ReturnType<typeof useDisplay>

/**
 * Connexa'nın merkezi responsive katmanı.
 *
 * Vuetify'ın `useDisplay()` composable'ını sarmalar ve ham breakpoint
 * kontrollerini (`mdAndUp`, `smAndDown`, …) bileşenlere dağıtmak yerine
 * **anlamsal layout token'larına** dönüştürür. Böylece "hangi genişlikte ne
 * olmalı" kararı tek yerde yaşar; bir breakpoint eşiğini değiştirmek istediğimizde
 * yalnızca burayı düzenleriz, onlarca bileşeni değil.
 *
 * Enterprise pratiği: bileşenler "compact mı?" diye sorar, "960px'in altında mı?"
 * diye değil.
 *
 * @see https://vuetifyjs.com/en/features/display-and-platform/
 */
export interface ResponsiveLayout {
  /** Ham Vuetify display örneği (name, width, height, xs…xxl, smAndUp…). */
  display: Display
  /**
   * Compact mod: pencere üç sütunlu yerleşim için fazla dar (< md / 960px).
   * Sol panel kalıcı sütun yerine overlay drawer'a döner.
   */
  compact: ComputedRef<boolean>
  /** Sol gezinme panelinin (hosts/identities/snippets) genişliği (px). */
  sidePanelWidth: ComputedRef<number>
  /**
   * Yardımcı panellerin (SFTP / Monitor) terminalin yanına gömülü (docked)
   * durabileceği kadar yatay alan var mı? (lg / 1280px ve üzeri). Aksi halde
   * overlay olarak açılırlar.
   */
  auxiliaryDocked: ComputedRef<boolean>
  /** SFTP / Monitor overlay drawer genişliği (px). */
  auxiliaryWidth: ComputedRef<number>
  /** Diyaloglar çok dar pencerede tam ekran açılmalı mı? (xs). */
  dialogFullscreen: ComputedRef<boolean>
  /** Ayarlar benzeri okuma-odaklı içerik için responsive max genişlik (px). */
  contentMaxWidth: ComputedRef<number>
  /** İçerik yoğunluğu: dar pencerede daha sıkı bileşenler. */
  density: ComputedRef<'compact' | 'comfortable'>
  /** Platform bayrakları (tauri, mac, win, touch, …). */
  platform: Display['platform']
  /** `<v-app>` köküne basılacak platform sınıfları (ör. "platform-tauri platform-mac"). */
  platformClasses: ComputedRef<string>
  /** Aktif breakpoint'in insan-okunur etiketi (ör. "lg · 1440×900"). */
  breakpointLabel: ComputedRef<string>
}

export function useResponsive(): ResponsiveLayout {
  const display = useDisplay()

  const compact = computed(() => display.mobile.value)

  const sidePanelWidth = computed(() => (display.lgAndUp.value ? 320 : 288))

  const auxiliaryDocked = computed(() => display.lgAndUp.value)

  const auxiliaryWidth = computed(() => (display.xlAndUp.value ? 420 : 360))

  const dialogFullscreen = computed(() => display.xs.value)

  const contentMaxWidth = computed(() => {
    if (display.xlAndUp.value) return 880
    if (display.lgAndUp.value) return 720
    return 640
  })

  const density = computed<'compact' | 'comfortable'>(() =>
    display.smAndDown.value ? 'compact' : 'comfortable'
  )

  const platform = display.platform

  const platformClasses = computed(() => {
    const p = display.platform.value
    const classes: string[] = []
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) classes.push('platform-tauri')
    if (p.mac) classes.push('platform-mac')
    if (p.win) classes.push('platform-win')
    if (p.linux) classes.push('platform-linux')
    if (p.touch) classes.push('platform-touch')
    return classes.join(' ')
  })

  const breakpointLabel = computed(
    () => `${display.name.value} · ${display.width.value}×${display.height.value}`
  )

  return {
    display,
    compact,
    sidePanelWidth,
    auxiliaryDocked,
    auxiliaryWidth,
    dialogFullscreen,
    contentMaxWidth,
    density,
    platform,
    platformClasses,
    breakpointLabel
  }
}
