import type { DefaultsInstance } from 'vuetify'

/**
 * Connexa global bileşen varsayılanları — tasarım sisteminin tek kaynağı.
 *
 * Vuetify'ın **defaults** sistemi, tekrar eden prop'ları (her form alanına
 * `density="comfortable"`, her uyarıya `variant="tonal"` …) bileşenlere tek tek
 * yazmak yerine merkezî bir yerde tanımlamamızı sağlar. Buradaki değerler
 * uygulamanın _yerleşik konvansiyonunu_ kodlar: yeni yazılan bileşenler prop'u
 * tekrar etmeden doğru görünümü alır, konvansiyonu değiştirmek tek dosyadır.
 *
 * Kapsamlı (bir alt ağaca özel) override için bkz. `<v-defaults-provider>`
 * — ör. araç çubuğundaki tüm butonların `size="small" variant="text"` olması.
 *
 * @see https://vuetifyjs.com/en/features/global-configuration/
 * @see https://vuetifyjs.com/en/components/defaults-providers/
 */
export const connexaDefaults: DefaultsInstance = {
  global: {
    ripple: true
  },
  // ── Yüzeyler ──────────────────────────────────────────────────────────────
  // Kartlar: kenarlık yok, MD3 "medium" köşe yarıçapı (rounded-lg) + hafif
  // yükseltme. Derinlik çizgiyle değil gölgeyle kurulur.
  VCard: { rounded: 'lg', variant: 'elevated', elevation: 2 },
  // Drawer/rail kenarlıkları kaldırılır: paneller ana zeminden yüzey rengiyle
  // ayrışır (bkz. [theme.ts] background↔surface), sert 1px çizgiyle değil.
  VNavigationDrawer: { border: false },
  VMenu: { rounded: 'lg' },
  VDialog: { rounded: 'xl' },
  // ── Eylemler ──────────────────────────────────────────────────────────────
  // MD3 butonları belirgin yuvarlak; ikon butonlar dairesel kalır (Vuetify).
  VBtn: { rounded: 'lg' },
  VChip: { rounded: 'lg' },
  // ── Form kontrolleri — uygulama genelinde 'comfortable' yoğunluk ───────────
  VTextField: { density: 'comfortable' },
  VTextarea: { density: 'comfortable' },
  VSelect: { density: 'comfortable' },
  VAutocomplete: { density: 'comfortable' },
  VCombobox: { density: 'comfortable' },
  VFileInput: { density: 'comfortable' },
  VSwitch: { density: 'comfortable', color: 'primary' },
  VCheckbox: { density: 'comfortable', color: 'primary' },
  VRadioGroup: { color: 'primary' },
  // ── Listeler ──────────────────────────────────────────────────────────────
  // Kompakt (gezinme/menü listeleri). `color: primary` → seçili/aktif öğe
  // primary durum katmanıyla vurgulanır (MD3 nav/liste imzası).
  VList: { density: 'compact' },
  VListItem: { color: 'primary', rounded: 'lg' },
  // Uyarılar: kompakt + tonal (uygulamadaki baskın kullanım).
  VAlert: { density: 'compact', variant: 'tonal', rounded: 'lg' },
  // Sekmeler: aktif göstergesi primary.
  VTabs: { color: 'primary' },
  // Kısayol rozetleri: tonal = kenarlıksız/gölgesiz yumuşak "tuş" çipi. Varsayılan
  // 'elevated' tuş-kapağı görünümü uygulamanın düz/kenarlıksız diline aykırıydı.
  VHotkey: { variant: 'tonal' }
}
