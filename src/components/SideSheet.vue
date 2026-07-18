<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResponsive } from '@/composables/useResponsive'

/**
 * SideSheet — Connexa'nın tek "modal panel" primitifi (Material 3 side sheet).
 *
 * Önceki sürüm bunu `v-navigation-drawer` ile kuruyordu. Navigation drawer,
 * Vuetify'ın **layout grid**'ine (app-bar/drawer/main için ortak yerleşim
 * hesaplayan sistem) kayıtlı bir bileşendir; aynı konumda (right) birden
 * fazla drawer aynı anda `active` olduğunda (iki panel art arda hızlı
 * açıldığında, ya da biri kapanış geçişini bitirmeden diğeri açıldığında)
 * layout ikisini de "geçerli" sayıp birbirinin genişliği kadar öteleyerek
 * yan yana diziyordu — sonuç: iki panel de yarım kesilmiş görünüyordu ve
 * biri bir türlü tam kapanmıyordu.
 *
 * Çözüm, yarış durumunu daha sıkı senkronize etmek değil; **yanlış
 * primitifi değiştirmek**: `v-dialog`, Vuetify'ın layout grid'ine hiç
 * katılmaz, kendi overlay stack'inde (z-index sıralı, `body`'ye teleport
 * edilen) bağımsız yüzer. Aynı anda birden fazla `v-dialog` açık olsa bile
 * birbirini itmez — üst üste biner (her biri kendi scrim'iyle). Sağdan
 * kayan tam-yükseklik bir panel görünümü, konumlandırmayı Vuetify'ın
 * ortalama mantığına bırakmadan doğrudan `content-class`/`content-props`
 * ile sabitleyerek elde edilir (bkz. altındaki `.side-sheet` stili).
 *
 * @see https://vuetifyjs.com/en/components/dialogs/
 */
const open = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    /** Üst başlık metni. */
    title: string
    /** Başlıkta gösterilecek ikon (opsiyonel). */
    icon?: string
    /** Geniş penceredeki panel genişliği (px). */
    width?: number | string
  }>(),
  { width: 560 }
)

const { t } = useI18n()
const { compact } = useResponsive()

const contentWidth = computed(() =>
  compact.value ? '100%' : typeof props.width === 'number' ? `${props.width}px` : props.width
)
</script>

<template>
  <v-dialog
    v-model="open"
    location-strategy="static"
    transition="slide-x-reverse-transition"
    content-class="side-sheet"
    :content-props="{ style: { width: contentWidth } }"
  >
    <div class="d-flex flex-column fill-height">
      <!-- HEADER — primary zemin (MD3 side-sheet başlığı) -->
      <v-toolbar color="primary" density="comfortable" flat class="flex-grow-0">
        <v-icon v-if="icon" :icon="icon" class="ms-4 me-1" />
        <v-toolbar-title class="text-body-1 font-weight-medium">{{ title }}</v-toolbar-title>
        <v-btn
          icon="mdi-close"
          :aria-label="t('common.close')"
          @click="open = false"
        />
      </v-toolbar>

      <!-- GÖVDE — kaydırılabilir içerik -->
      <div class="side-sheet__body flex-grow-1 overflow-y-auto">
        <slot />
      </div>

      <!-- FOOTER — sabit alt eylem barı (opsiyonel) -->
      <div v-if="$slots.footer" class="side-sheet__footer flex-grow-0">
        <slot name="footer" />
      </div>
    </div>
  </v-dialog>
</template>

<style>
/* content-class bir global class'tır (v-overlay içeriği teleport edildiğinden
   scoped attribute burada uygulanamaz); isim çarpışmasını önlemek için
   `.side-sheet` tüm uygulamada bu bileşene özel kabul edilir. */
.side-sheet {
  position: fixed !important;
  inset: 0 0 0 auto !important;
  margin: 0 !important;
  height: 100% !important;
  max-height: 100% !important;
  max-width: 100vw !important;
  border-radius: 0 !important;
  /* v-dialog içeriği normalde şeffaftır (opak zemini kendi v-card'ı verir);
     burada kart kullanmadığımızdan yüzey rengini elle veriyoruz, aksi halde
     arkadaki (scrim altındaki) içerik panelin gövdesinden sızar. */
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.2);
}

.side-sheet__footer {
  padding: 12px 16px;
  /* Kenarlık değil; çok hafif bir yüzey gölgesiyle gövdeden ayrışır. */
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
}
</style>
