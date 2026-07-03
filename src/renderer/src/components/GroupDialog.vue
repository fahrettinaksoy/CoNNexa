<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import type { Group } from '@shared/types'

const props = defineProps<{
  modelValue: boolean
  group?: Group | null
  /** Yeni grup için önerilen üst grup */
  parentId?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()
const vault = useVaultStore()

const form = ref<Group>({ id: '', name: '' })

watch(
  () => props.modelValue,
  (openNow) => {
    if (!openNow) return
    form.value = props.group
      ? { ...props.group }
      : { id: '', name: '', parentId: props.parentId }
  }
)

/** Düzenlenen grubun kendisi ve tüm altları üst grup olamaz (döngü koruması) */
const descendantIds = computed(() => {
  const ids = new Set<string>()
  if (!props.group) return ids
  const collect = (id: string): void => {
    ids.add(id)
    for (const child of vault.groups.filter((g) => g.parentId === id)) collect(child.id)
  }
  collect(props.group.id)
  return ids
})

const parentItems = computed(() =>
  vault.groups
    .filter((g) => !descendantIds.value.has(g.id))
    .map((g) => ({ title: g.name, value: g.id }))
)

const identityItems = computed(() =>
  vault.identities.map((i) => ({ title: `${i.name} (${i.username})`, value: i.id }))
)

async function save(): Promise<void> {
  await vault.saveGroup(form.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="440"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card :title="group ? t('groups.edit') : t('groups.add')">
      <v-card-text>
        <v-text-field v-model="form.name" :label="t('groups.name')" density="comfortable" />
        <v-select
          v-model="form.parentId"
          :items="parentItems"
          :label="t('groups.parent')"
          density="comfortable"
          clearable
        />
        <v-select
          v-model="form.identityId"
          :items="identityItems"
          :label="t('groups.defaultIdentity')"
          :hint="t('groups.defaultIdentityHint')"
          persistent-hint
          density="comfortable"
          clearable
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" variant="flat" :disabled="!form.name.trim()" @click="save">
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
