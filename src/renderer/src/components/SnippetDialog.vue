<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import type { Snippet } from '@shared/types'

const props = defineProps<{
  modelValue: boolean
  snippet?: Snippet | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()
const vault = useVaultStore()

const form = ref<Snippet>(emptyForm())

function emptyForm(): Snippet {
  return { id: '', name: '', command: '', tags: [] }
}

watch(
  () => props.modelValue,
  (openNow) => {
    if (openNow) form.value = props.snippet ? { ...props.snippet } : emptyForm()
  }
)

const valid = computed(
  () => form.value.name.trim() !== '' && form.value.command.trim() !== ''
)

async function save(): Promise<void> {
  await vault.saveSnippet(form.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card :title="snippet ? t('snippets.edit') : t('snippets.add')">
      <v-card-text>
        <v-text-field v-model="form.name" :label="t('snippets.name')" density="comfortable" />
        <v-textarea
          v-model="form.command"
          :label="t('snippets.command')"
          density="comfortable"
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
          density="comfortable"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" variant="flat" :disabled="!valid" @click="save">
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.command-field :deep(textarea) {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 13px;
}
</style>
