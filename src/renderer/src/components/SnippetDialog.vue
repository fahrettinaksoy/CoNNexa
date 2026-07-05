<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { useRules } from '@/composables/rules'
import CrudDialog from '@/components/CrudDialog.vue'
import type { Snippet } from '@shared/types'

const model = defineModel<boolean>({ default: false })
const props = defineProps<{ snippet?: Snippet | null }>()

const { t } = useI18n()
const vault = useVaultStore()
const { required } = useRules()

const form = ref<Snippet>(emptyForm())

function emptyForm(): Snippet {
  return { id: '', name: '', command: '', tags: [] }
}

watch(model, (openNow) => {
  if (openNow) form.value = props.snippet ? { ...props.snippet } : emptyForm()
})

async function save(): Promise<void> {
  await vault.saveSnippet(form.value)
  model.value = false
}
</script>

<template>
  <CrudDialog
    v-model="model"
    :title="snippet ? t('snippets.edit') : t('snippets.add')"
    @save="save"
  >
    <v-text-field
      v-model="form.name"
      :label="t('snippets.name')"
      :rules="[required]"
      autofocus
    />
    <v-textarea
      v-model="form.command"
      :label="t('snippets.command')"
      :rules="[required]"
      auto-grow
      rows="3"
      class="command-field"
    />
    <v-combobox
      v-model="form.tags"
      :label="t('hosts.tags')"
      multiple
      chips
      closable-chips
    />
  </CrudDialog>
</template>

<style scoped>
.command-field :deep(textarea) {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 13px;
}
</style>
