<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import type { Tunnel, TunnelType } from '@shared/types'

const props = defineProps<{
  modelValue: boolean
  tunnel?: Tunnel | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()
const vault = useVaultStore()

const form = ref<Tunnel>(emptyForm())

function emptyForm(): Tunnel {
  return {
    id: '',
    name: '',
    hostId: '',
    type: 'local',
    listenHost: '127.0.0.1',
    listenPort: 8080,
    destHost: '',
    destPort: undefined
  }
}

watch(
  () => props.modelValue,
  (openNow) => {
    if (openNow) form.value = props.tunnel ? { ...props.tunnel } : emptyForm()
  }
)

const typeItems = computed(() => [
  { title: t('tunnels.types.local'), value: 'local' as TunnelType },
  { title: t('tunnels.types.remote'), value: 'remote' as TunnelType },
  { title: t('tunnels.types.dynamic'), value: 'dynamic' as TunnelType }
])

// SSH hostları tünel taşıyıcısı olabilir
const hostItems = computed(() =>
  vault.hosts
    .filter((h) => h.protocol === 'ssh')
    .map((h) => ({ title: `${h.name} (${h.hostname})`, value: h.id }))
)

const needsDest = computed(() => form.value.type !== 'dynamic')

const valid = computed(
  () =>
    form.value.name.trim() !== '' &&
    form.value.hostId !== '' &&
    form.value.listenPort > 0 &&
    (!needsDest.value || (Boolean(form.value.destHost?.trim()) && Boolean(form.value.destPort)))
)

async function save(): Promise<void> {
  const payload = { ...form.value }
  if (payload.type === 'dynamic') {
    payload.destHost = undefined
    payload.destPort = undefined
  }
  await window.connexa.vault.saveTunnel(JSON.parse(JSON.stringify(payload)))
  await vault.load()
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card :title="tunnel ? t('tunnels.edit') : t('tunnels.add')">
      <v-card-text>
        <v-text-field v-model="form.name" :label="t('tunnels.name')" density="comfortable" />
        <v-select
          v-model="form.type"
          :items="typeItems"
          :label="t('tunnels.type')"
          density="comfortable"
        />
        <v-select
          v-model="form.hostId"
          :items="hostItems"
          :label="t('tunnels.host')"
          density="comfortable"
        />
        <v-row>
          <v-col cols="8">
            <v-text-field
              v-model="form.listenHost"
              :label="t('tunnels.listenHost')"
              density="comfortable"
            />
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model.number="form.listenPort"
              :label="t('tunnels.listenPort')"
              type="number"
              density="comfortable"
            />
          </v-col>
        </v-row>
        <v-row v-if="needsDest" dense>
          <v-col cols="8">
            <v-text-field
              v-model="form.destHost"
              :label="t('tunnels.destHost')"
              density="comfortable"
            />
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model.number="form.destPort"
              :label="t('tunnels.destPort')"
              type="number"
              density="comfortable"
            />
          </v-col>
        </v-row>
        <div class="text-caption text-medium-emphasis">{{ t(`tunnels.hints.${form.type}`) }}</div>
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
