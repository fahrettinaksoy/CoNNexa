<script setup lang="ts">
import type { VForm } from 'vuetify/components'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SideSheet from '@/components/SideSheet.vue'

withDefaults(
  defineProps<{
    /** Panel başlığı (primary header). */
    title: string
    /** Geniş penceredeki panel genişliği (px). */
    maxWidth?: number | string
  }>(),
  { maxWidth: 520 }
)

const emit = defineEmits<{
  /** Form doğrulaması geçtiğinde yayılır; ebeveyn kaydetme işini yapar. */
  save: []
}>()

/**
 * CrudDialog — CRUD ekle/düzenle formları için yeniden kullanılabilir kabuk.
 *
 * Beş varlık formu (Host/Identity/Group/Snippet/Tunnel) + ekip düzenleme yapı
 * olarak ~%90 aynıydı: başlık + form alanları + iptal/kaydet, artı gönderimde
 * doğrulama. Tümü tek [[side-sheet]] deseninde açılır: sağdan kayan panel,
 * **primary başlık**, sabit **footer**. Her form yalnızca kendi **alanlarını**
 * (default slot) ve **kaydetme mantığını** (`@save`) sağlar.
 *
 * - `v-model` (defineModel) panelin açık/kapalı durumunu iki yönlü bağlar.
 * - `<v-form>` sahipliği burada; gönderimde `validate()` çalışır, yalnızca
 *   geçerliyse `save` yayılır. Alanlar slot'ta `:rules` ile gelir (bkz. [[rules]]).
 */
const open = defineModel<boolean>({ default: false })

const { t } = useI18n()
const formRef = ref<VForm>()

async function submit(): Promise<void> {
  const result = await formRef.value?.validate()
  if (result && !result.valid) return
  emit('save')
}
</script>

<template>
  <SideSheet v-model="open" :title="title" :width="maxWidth">
    <v-form ref="formRef" class="pa-4" @submit.prevent="submit">
      <slot />
    </v-form>
    <template #footer>
      <div class="d-flex ga-2 justify-end">
        <v-btn variant="text" @click="open = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" @click="submit">{{ t('common.save') }}</v-btn>
      </div>
    </template>
  </SideSheet>
</template>
