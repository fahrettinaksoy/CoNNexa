<script setup lang="ts">
import type { ShortcutCategory } from '@/composables/keymap'
import { useI18n } from 'vue-i18n'
import SideSheet from '@/components/SideSheet.vue'
import { CATEGORY_ORDER, SHORTCUTS_BY_CATEGORY } from '@/composables/keymap'

const open = defineModel<boolean>({ default: false })

const { t } = useI18n()

const categoryIcon: Record<ShortcutCategory, string> = {
  general: 'mdi-star-outline',
  navigation: 'mdi-compass-outline',
  session: 'mdi-console',
  panels: 'mdi-view-split-vertical'
}
</script>

<template>
  <SideSheet v-model="open" :title="t('hotkeys.title')" icon="mdi-keyboard-outline" :width="480">
    <template v-for="category in CATEGORY_ORDER" :key="category">
      <v-list-subheader class="text-uppercase font-weight-bold">
        <v-icon :icon="categoryIcon[category]" size="small" class="mr-2" />
        {{ t(`hotkeys.categories.${category}`) }}
      </v-list-subheader>
      <v-list density="comfortable" class="py-0 bg-transparent">
        <v-list-item
          v-for="def in SHORTCUTS_BY_CATEGORY[category]"
          :key="def.id"
          :title="t(def.i18nKey)"
        >
          <template #append>
            <v-hotkey :keys="def.keys" />
          </template>
        </v-list-item>
      </v-list>
    </template>

    <template #footer>
      <div class="d-flex align-center">
        <span class="text-caption text-medium-emphasis">{{ t('hotkeys.footer') }}</span>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.close') }}</v-btn>
      </div>
    </template>
  </SideSheet>
</template>
