import { useI18n } from 'vue-i18n'
import { createVuetify } from 'vuetify'
import { mdi, aliases as mdiAliases } from 'vuetify/iconsets/mdi'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import { i18n } from '@/i18n'
import { connexaDefaults } from './defaults'
import { appAliases } from './icons'
import { connexaThemes } from './theme'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

// Kalıcı tema modunu ('system' | 'light' | 'dark') açılışta uygula; böylece
// ilk boyamada yanlış tema görünüp anında değişmez (FOUC yok). 'system' ise
// Vuetify OS tercihini (`prefers-color-scheme`) canlı takip eder.
const persistedTheme = localStorage.getItem('connexa:theme') ?? 'system'

export const vuetify = createVuetify({
  // Bileşenler ve direktifler global kaydedilmez; vite-plugin-vuetify (autoImport)
  // her .vue'da yalnızca kullanılanları on-demand içeri alır. Bkz. vite.config.ts
  // — https://vuetifyjs.com/en/features/treeshaking/
  // Defaults — https://vuetifyjs.com/en/components/defaults-providers/
  // Tekrar eden prop'lar (form yoğunluğu, uyarı stili …) merkezî tanımlanır; bkz. [defaults.ts].
  defaults: connexaDefaults,
  // Internationalization — https://vuetifyjs.com/en/features/internationalization/
  // Vuetify'ın locale sistemi vue-i18n adaptörüne bağlanır: bileşenlerin dahili
  // metinleri uygulama diliyle aynı kaynaktan (aynı i18n örneği) yönetilir.
  // `rtl` haritası ileride RTL diller (ar, fa, he …) eklenirse yön desteğini hazır tutar.
  locale: {
    // vue-i18n'in katı mesaj-şeması çıkarımı, adaptörün beklediği gevşek
    // `I18n<any, …>` tipiyle örtüşmez; adaptör sınırında cast idiomatiktir.
    adapter: createVueI18nAdapter({ i18n: i18n as never, useI18n }),
    rtl: {
      ar: true,
      fa: true,
      he: true
    }
  },
  // Icon fonts — https://vuetifyjs.com/en/features/icon-fonts/
  // MDI webfont'u açık şekilde varsayılan set olarak seçilir. Vuetify'ın yerleşik
  // alias'ları ($success, $error, $menu …) korunur ve üzerine Connexa'nın semantik
  // alias'ları (protocolSsh, host …) eklenir; bkz. [icons.ts]. Bileşenler ham
  // `mdi-*` yerine `$alias` kullanabilir.
  icons: {
    defaultSet: 'mdi',
    aliases: { ...mdiAliases, ...appAliases },
    sets: { mdi }
  },
  // Display & Platform — https://vuetifyjs.com/en/features/display-and-platform/
  // Connexa bir masaüstü penceresidir; eşikler pencere genişliğine göre yorumlanır.
  // `mobileBreakpoint: 'md'` → 960px altında uygulama "compact" moda geçer:
  // sol panel kalıcı sütun yerine overlay drawer olur, yardımcı paneller katmanlanır.
  display: {
    mobileBreakpoint: 'md',
    thresholds: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
      xxl: 2560
    }
  },
  // Theme — https://vuetifyjs.com/en/features/theme/
  // Renkler semantik token registry'sinde toplanır (bkz. [theme.ts]); mod yönetimi
  // (system/light/dark) [useAppTheme] composable'ında tek kaynaktan yürütülür.
  theme: {
    defaultTheme: persistedTheme,
    themes: connexaThemes
  }
})
