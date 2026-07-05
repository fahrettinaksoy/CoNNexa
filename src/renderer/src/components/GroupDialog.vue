<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { useRules } from '@/composables/rules'
import CrudDialog from '@/components/CrudDialog.vue'
import type { Group } from '@shared/types'

const model = defineModel<boolean>({ default: false })
const props = defineProps<{
  group?: Group | null
  /** Yeni grup için önerilen üst grup */
  parentId?: string
}>()

const { t } = useI18n()
const vault = useVaultStore()
const { required } = useRules()

const form = ref<Group>({ id: '', name: '' })

watch(model, (openNow) => {
  if (!openNow) return
  form.value = props.group
    ? { ...props.group }
    : { id: '', name: '', parentId: props.parentId }
})

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
  model.value = false
}
</script>

<template>
  <CrudDialog
    v-model="model"
    :title="group ? t('groups.edit') : t('groups.add')"
    :max-width="440"
    @save="save"
  >
    <v-text-field
      v-model="form.name"
      :label="t('groups.name')"
      :rules="[required]"
      autofocus
    />
    <v-select
      v-model="form.parentId"
      :items="parentItems"
      :label="t('groups.parent')"
      clearable
    />
    <v-select
      v-model="form.identityId"
      :items="identityItems"
      :label="t('groups.defaultIdentity')"
      :hint="t('groups.defaultIdentityHint')"
      persistent-hint
      clearable
    />
  </CrudDialog>
</template>
