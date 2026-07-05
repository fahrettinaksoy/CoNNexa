import { useI18n } from 'vue-i18n'

/** Vuetify doğrulama kuralı: geçerliyse `true`, değilse hata metni döndürür. */
export type ValidationRule = (value: unknown) => true | string

/**
 * Paylaşılan, i18n-duyarlı form doğrulama kuralları.
 *
 * Vuetify'ın `<v-form>` + alan `:rules` mekanizmasıyla kullanılır; kurallar tek
 * yerde tanımlanır ki mesajlar ve mantık dialoglar arasında tutarlı olsun.
 * Elle `.trim()` boolean'ları yerine gerçek alan-seviyesi hata mesajları verir.
 *
 * @example
 * const { required, port } = useRules()
 * <v-text-field :rules="[required]" />
 * <v-text-field type="number" :rules="[port]" />
 */
export function useRules(): {
  required: ValidationRule
  port: ValidationRule
  positiveInt: ValidationRule
} {
  const { t } = useI18n()

  const required: ValidationRule = (v) =>
    (v !== null && v !== undefined && String(v).trim().length > 0) || t('common.required')

  const port: ValidationRule = (v) => {
    const n = Number(v)
    return (Number.isInteger(n) && n >= 1 && n <= 65535) || t('validation.port')
  }

  const positiveInt: ValidationRule = (v) => {
    const n = Number(v)
    return (Number.isInteger(n) && n > 0) || t('validation.positive')
  }

  return { required, port, positiveInt }
}
