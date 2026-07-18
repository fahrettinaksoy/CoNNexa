/**
 * Connexa klavye kısayolları — tek gerçek kaynağı (single source of truth).
 *
 * Tüm uygulama kısayolları burada _bildirimsel_ olarak tanımlanır: kimlik, tuş
 * kombinasyonu, kategori ve i18n açıklama anahtarı. Ne yaptıkları (handler'lar)
 * bağlamın bulunduğu bileşende `useAppHotkeys` ile bağlanır. Böylece kısayollar
 * tek yerden listelenebilir, yardım penceresinde (`VHotkey`) gösterilebilir ve
 * belgelenebilir; `useHotkey` çağrıları bileşenlere dağılmaz.
 *
 * @see https://vuetifyjs.com/en/features/hotkey/
 *
 * ── Platforma duyarlı tuş üretimi ──────────────────────────────────────────
 * Bu bir terminal yöneticisidir; kısayollar terminal odaktayken de çalışmalıdır
 * (`inputs: true`). Ancak Vuetify'ın `cmd` token'ı Mac dışında `ctrl`'e çözülür
 * ve `Ctrl+D` (EOF), `Ctrl+W` (kelime sil), `Ctrl+T` gibi kombinasyonlar kabuk
 * kontrol kodlarıyla çakışır. Bu yüzden:
 *   • `primary(k)`  → Mac: `cmd+k`, diğer: `ctrl+k`  (rakam/işaret için güvenli)
 *   • `action(k)`   → Mac: `cmd+k`, diğer: `ctrl+shift+k`  (harf çakışmalarını önler)
 *   • `actionAlt(k)`→ Mac: `cmd+shift+k`, diğer: `ctrl+alt+k`  (ikincil harf eylemleri)
 *
 * Not: `Shift` + rakam/işaret, `event.key`'i değiştirdiği için (ör. Shift+1 → "!")
 * güvenilmezdir; bu yüzden shift'li kombinasyonlarda yalnızca harf/özel tuş kullanılır.
 */

export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

/** Cmd (Mac) / Ctrl (diğer) — rakam ve işaret tuşları için. */
const primary = (key: string): string => `cmd+${key}`
/** Cmd (Mac) / Ctrl+Shift (diğer) — terminal kontrol koduyla çakışabilecek harfler için. */
const action = (key: string): string => (isMac ? `cmd+${key}` : `ctrl+shift+${key}`)
/** Cmd+Shift (Mac) / Ctrl+Alt (diğer) — ikincil harf eylemleri için. */
const actionAlt = (key: string): string => (isMac ? `cmd+shift+${key}` : `ctrl+alt+${key}`)

export type ShortcutId =
  | 'palette'
  | 'help'
  | 'settings'
  | 'goWorkspace'
  | 'goTunnels'
  | 'goSync'
  | 'goTeams'
  | 'newTerminal'
  | 'closeSession'
  | 'splitVertical'
  | 'splitHorizontal'
  | 'nextTab'
  | 'prevTab'
  | 'toggleSftp'
  | 'toggleMonitor'
  | 'toggleBroadcast'
  | 'toggleRecording'
  | 'aiAssistant'

export type ShortcutCategory = 'general' | 'navigation' | 'session' | 'panels'

/** Kısayolun kapsamı: global her ekranda, workspace yalnızca çalışma alanında. */
export type ShortcutScope = 'global' | 'workspace'

export interface ShortcutDef {
  id: ShortcutId
  /** Vuetify hotkey söz dizimi; hem `useHotkey` hem `VHotkey` bunu tüketir. */
  keys: string
  category: ShortcutCategory
  /** i18n açıklama anahtarı (ör. "hotkeys.actions.palette"). */
  i18nKey: string
  scope: ShortcutScope
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  // Genel
  {
    id: 'palette',
    keys: action('k'),
    category: 'general',
    i18nKey: 'hotkeys.actions.palette',
    scope: 'global'
  },
  {
    id: 'help',
    keys: primary('/'),
    category: 'general',
    i18nKey: 'hotkeys.actions.help',
    scope: 'global'
  },
  {
    id: 'settings',
    keys: primary(','),
    category: 'general',
    i18nKey: 'hotkeys.actions.settings',
    scope: 'global'
  },

  // Gezinme
  {
    id: 'goWorkspace',
    keys: primary('1'),
    category: 'navigation',
    i18nKey: 'hotkeys.actions.goWorkspace',
    scope: 'global'
  },
  {
    id: 'goTunnels',
    keys: primary('2'),
    category: 'navigation',
    i18nKey: 'hotkeys.actions.goTunnels',
    scope: 'global'
  },
  {
    id: 'goSync',
    keys: primary('3'),
    category: 'navigation',
    i18nKey: 'hotkeys.actions.goSync',
    scope: 'global'
  },
  {
    id: 'goTeams',
    keys: primary('4'),
    category: 'navigation',
    i18nKey: 'hotkeys.actions.goTeams',
    scope: 'global'
  },

  // Oturum
  {
    id: 'newTerminal',
    keys: action('t'),
    category: 'session',
    i18nKey: 'hotkeys.actions.newTerminal',
    scope: 'workspace'
  },
  {
    id: 'closeSession',
    keys: action('w'),
    category: 'session',
    i18nKey: 'hotkeys.actions.closeSession',
    scope: 'workspace'
  },
  {
    id: 'splitVertical',
    keys: action('d'),
    category: 'session',
    i18nKey: 'hotkeys.actions.splitVertical',
    scope: 'workspace'
  },
  {
    id: 'splitHorizontal',
    keys: actionAlt('d'),
    category: 'session',
    i18nKey: 'hotkeys.actions.splitHorizontal',
    scope: 'workspace'
  },
  {
    id: 'nextTab',
    keys: 'ctrl+tab',
    category: 'session',
    i18nKey: 'hotkeys.actions.nextTab',
    scope: 'workspace'
  },
  {
    id: 'prevTab',
    keys: 'ctrl+shift+tab',
    category: 'session',
    i18nKey: 'hotkeys.actions.prevTab',
    scope: 'workspace'
  },

  // Paneller
  {
    id: 'toggleSftp',
    keys: actionAlt('f'),
    category: 'panels',
    i18nKey: 'hotkeys.actions.toggleSftp',
    scope: 'workspace'
  },
  {
    id: 'toggleMonitor',
    keys: actionAlt('m'),
    category: 'panels',
    i18nKey: 'hotkeys.actions.toggleMonitor',
    scope: 'workspace'
  },
  {
    id: 'toggleBroadcast',
    keys: actionAlt('b'),
    category: 'panels',
    i18nKey: 'hotkeys.actions.toggleBroadcast',
    scope: 'workspace'
  },
  {
    id: 'toggleRecording',
    keys: actionAlt('r'),
    category: 'panels',
    i18nKey: 'hotkeys.actions.toggleRecording',
    scope: 'workspace'
  },
  {
    id: 'aiAssistant',
    keys: action('i'),
    category: 'panels',
    i18nKey: 'hotkeys.actions.aiAssistant',
    scope: 'workspace'
  }
]

/** Belirli bir kimliğin tuş dizesini döndürür (ör. buton ipuçları için). */
export function keysFor(id: ShortcutId): string {
  return SHORTCUTS.find((s) => s.id === id)?.keys ?? ''
}

/** Kategorilere göre gruplanmış kısayollar (yardım penceresi için). */
export const SHORTCUTS_BY_CATEGORY: Record<ShortcutCategory, ShortcutDef[]> = SHORTCUTS.reduce(
  (acc, def) => {
    ;(acc[def.category] ??= []).push(def)
    return acc
  },
  {} as Record<ShortcutCategory, ShortcutDef[]>
)

export const CATEGORY_ORDER: ShortcutCategory[] = ['general', 'navigation', 'session', 'panels']
