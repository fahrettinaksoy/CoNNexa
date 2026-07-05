import type { ThemeDefinition } from 'vuetify'

/**
 * Connexa tema tanımları — renklerin tek gerçek kaynağı.
 *
 * Vuetify'ın **theme** özelliği, tüm renkleri semantik token'lar (primary,
 * surface, error …) olarak tanımlamamızı ve bunları CSS değişkenleri
 * (`--v-theme-<ad>`) üzerinden hem bileşenlerde hem özel CSS'te tutarlıca
 * kullanmamızı sağlar. Böylece marka/renk değişimi tek dosyadan yapılır.
 *
 * Her iki tema da **tam** semantik paleti tanımlar (yalnızca primary/surface
 * değil; error/info/success/warning ve surface varyantları). Aksi halde durum
 * renkleri Vuetify'ın varsayılanlarına düşer ve markayla tutarsız görünür.
 *
 * @see https://vuetifyjs.com/en/features/theme/
 */

/*
 * Material 3 yüzey hiyerarşisi. Derinlik "border" ile değil, birbirinden hafifçe
 * ayrışan yüzey renkleri + gölge (elevation) ile kurulur:
 *   background  → uygulama zemini (en düşük)
 *   surface     → paneller/drawer (zeminden bir kademe yukarı)
 *   surface-light / -bright → yükseltilmiş konteynerler (kart, menü)
 *   surface-variant → tonal doldurmalar (chip, seçili hâl arkaplanı)
 * `primary-container` MD3'ün tonal vurgu rengidir: primary'nin yumuşak, düşük
 * vurgulu türevi; seçili nav öğesi ve tonal butonlarda marka tutarlılığı sağlar.
 */
const dark: ThemeDefinition = {
  dark: true,
  colors: {
    background: '#0C0E12',
    surface: '#14161C',
    'surface-light': '#1B1E26',
    'surface-bright': '#242833',
    'surface-variant': '#2C313C',
    'on-surface-variant': '#C4C9D4',
    primary: '#7AA7FF',
    'primary-container': '#1E2E4D',
    'on-primary-container': '#D5E2FF',
    secondary: '#B69DFF',
    error: '#FF6B6B',
    info: '#5CC8FF',
    success: '#6FCF7A',
    warning: '#FFB74D'
  },
  variables: {
    // Kenarlıklar neredeyse görünmez; ayrım rengi/gölge üstlenir.
    'border-opacity': 0.06,
    'high-emphasis-opacity': 0.94,
    'medium-emphasis-opacity': 0.68,
    // MD3 durum katmanları (hover/seçili) — primary üzerinden okunur.
    'hover-opacity': 0.06,
    'focus-opacity': 0.10,
    'selected-opacity': 0.14,
    'activated-opacity': 0.14,
    // Yükseltilmiş yüzeylere hafif primary "tint" katarak MD3 rengini yakalar.
    'theme-surface-tint': '#7AA7FF'
  }
}

const light: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#F4F6FB',
    surface: '#FFFFFF',
    'surface-light': '#F7F9FD',
    'surface-bright': '#FFFFFF',
    'surface-variant': '#E6EAF2',
    'on-surface-variant': '#44474F',
    primary: '#2962FF',
    'primary-container': '#DCE5FF',
    'on-primary-container': '#001945',
    secondary: '#6741D9',
    error: '#D3302F',
    info: '#0277BD',
    success: '#2E7D32',
    warning: '#E67700'
  },
  variables: {
    'border-opacity': 0.08,
    'high-emphasis-opacity': 0.88,
    'medium-emphasis-opacity': 0.62,
    'hover-opacity': 0.05,
    'focus-opacity': 0.10,
    'selected-opacity': 0.10,
    'activated-opacity': 0.10,
    'theme-surface-tint': '#2962FF'
  }
}

/** createVuetify({ theme: { themes: connexaThemes } }) için tema kayıt defteri. */
export const connexaThemes: Record<string, ThemeDefinition> = { dark, light }
