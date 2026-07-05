import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useHotkey } from 'vuetify'
import { SHORTCUTS, type ShortcutId, type ShortcutScope } from './keymap'

export type HotkeyHandlers = Partial<Record<ShortcutId, (e: KeyboardEvent) => void>>

export interface UseAppHotkeysOptions {
  /**
   * Kısayolların etkin olup olmadığı. `false` olduğunda `keys` `undefined`'a
   * döner ve `useHotkey` window dinleyicisini kaldırır — böylece keep-alive ile
   * ayakta kalan ama görünmeyen bir view'ın kısayolları arka planda tetiklenmez.
   * Varsayılan: her zaman etkin.
   */
  enabled?: MaybeRefOrGetter<boolean>
  /**
   * Verildiğinde, yalnızca bu kapsamdaki (`SHORTCUTS[].scope`) kısayollar bağlanır.
   * Böylece registry'deki `scope` alanı dekoratif metadata olmaktan çıkıp
   * uygulanır: bir 'workspace' kısayolu yanlışlıkla global kaydedilmeye çalışılsa
   * bile atlanır (dev'de uyarı verilir).
   */
  scope?: ShortcutScope
}

/**
 * Verilen handler eşlemesi için merkezî keymap'ten (`SHORTCUTS`) `useHotkey`
 * kayıtlarını kurar.
 *
 * - Yalnızca handler verilen kısayollar bağlanır.
 * - `inputs: true`: kısayollar terminal/metin alanı odaktayken de çalışır. Tüm
 *   kombinasyonlar bir modifier (Cmd/Ctrl) içerdiği için metin girişini bozmaz;
 *   platforma duyarlı tuş seçimi terminal kontrol kodu çakışmalarını önler
 *   (bkz. [[keymap]]).
 * - `preventDefault: true`: kısayol tuşu terminale/tarayıcıya sızmaz.
 * - Temizleme `useHotkey`'in scope-dispose davranışıyla otomatiktir; ayrıca
 *   `enabled` reaktif olarak kayıtları açıp kapatır.
 *
 * @example
 * useAppHotkeys({
 *   palette: () => palette.toggle(),
 *   goWorkspace: () => router.push({ name: 'workspace' })
 * })
 */
export function useAppHotkeys(handlers: HotkeyHandlers, options: UseAppHotkeysOptions = {}): void {
  const enabled = options.enabled ?? true

  for (const def of SHORTCUTS) {
    const handler = handlers[def.id]
    if (!handler) continue

    // Kapsam uygulaması: verilen scope ile registry'deki scope uyuşmuyorsa bağlama.
    if (options.scope && def.scope !== options.scope) {
      if (import.meta.env.DEV) {
        console.warn(
          `[useAppHotkeys] "${def.id}" kısayolu '${def.scope}' kapsamında ama ` +
            `'${options.scope}' kapsamında kaydedilmeye çalışıldı; atlanıyor.`
        )
      }
      continue
    }

    const keys = computed(() => (toValue(enabled) ? def.keys : undefined))
    useHotkey(keys, handler, { inputs: true, preventDefault: true })
  }
}
