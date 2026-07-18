import { createI18n } from 'vue-i18n'
import { en as vuetifyEn, tr as vuetifyTr } from 'vuetify/locale'
import en from './locales/en'
import tr from './locales/tr'

/**
 * vue-i18n örneği — uygulamanın metinlerinin yanı sıra Vuetify bileşenlerinin
 * dahili metinlerini de (VDataTable "no data", VPagination aria etiketleri,
 * "items per page" vb.) besler.
 *
 * Vuetify'ın vue-i18n adaptörü (bkz. [plugins/vuetify.ts]) bileşen metinlerini
 * `$vuetify.*` anahtarları üzerinden okur; bu yüzden Vuetify'ın hazır çeviri
 * paketleri (`vuetify/locale`) her dilin altına `$vuetify` olarak yerleştirilir.
 * Böylece tüm arayüz — uygulama + Vuetify — tek locale kaynağından yönetilir.
 *
 * @see https://vuetifyjs.com/en/features/internationalization/
 */
export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('connexa:locale') ?? 'tr',
  fallbackLocale: 'en',
  messages: {
    tr: { ...tr, $vuetify: vuetifyTr },
    en: { ...en, $vuetify: vuetifyEn }
  },
  // Locale'e duyarlı tarih/sayı biçimlendirme (bileşenlerde `d()` / `n()`,
  // uygulama genelinde `useAppLocale().formatDate/formatNumber`).
  datetimeFormats: {
    tr: {
      short: { year: 'numeric', month: '2-digit', day: '2-digit' },
      long: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    },
    en: {
      short: { year: 'numeric', month: '2-digit', day: '2-digit' },
      long: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    }
  },
  numberFormats: {
    tr: {
      decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
      percent: { style: 'percent', maximumFractionDigits: 1 }
    },
    en: {
      decimal: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
      percent: { style: 'percent', maximumFractionDigits: 1 }
    }
  }
})
