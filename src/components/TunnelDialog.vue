<script setup lang="ts">
import type { Tunnel, TunnelType } from '@shared/types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CrudDialog from '@/components/CrudDialog.vue'
import { useRules } from '@/composables/rules'
import { useVaultStore } from '@/stores/vault'

const props = defineProps<{ tunnel?: Tunnel | null }>()
const model = defineModel<boolean>({ default: false })
const { t } = useI18n()
const vault = useVaultStore()
const { required, port } = useRules()

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

watch(model, (openNow) => {
  if (openNow) form.value = props.tunnel ? { ...props.tunnel } : emptyForm()
})

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

async function save(): Promise<void> {
  const payload = { ...form.value }
  if (payload.type === 'dynamic') {
    payload.destHost = undefined
    payload.destPort = undefined
  }
  await vault.saveTunnel(payload)
  model.value = false
}
</script>

<template>
  <CrudDialog v-model="model" :title="tunnel ? t('tunnels.edit') : t('tunnels.add')" @save="save">
    <v-text-field v-model="form.name" :label="t('tunnels.name')" :rules="[required]" autofocus />
    <v-select v-model="form.type" :items="typeItems" :label="t('tunnels.type')" />
    <v-select
      v-model="form.hostId"
      :items="hostItems"
      :label="t('tunnels.host')"
      :rules="[required]"
    />
    <v-row>
      <v-col cols="8">
        <v-text-field
          v-model="form.listenHost"
          :label="t('tunnels.listenHost')"
          :rules="[required]"
        />
      </v-col>
      <v-col cols="4">
        <v-text-field
          v-model.number="form.listenPort"
          :label="t('tunnels.listenPort')"
          type="number"
          :rules="[port]"
        />
      </v-col>
    </v-row>
    <v-row v-if="needsDest" dense>
      <v-col cols="8">
        <v-text-field v-model="form.destHost" :label="t('tunnels.destHost')" :rules="[required]" />
      </v-col>
      <v-col cols="4">
        <v-text-field
          v-model.number="form.destPort"
          :label="t('tunnels.destPort')"
          type="number"
          :rules="[port]"
        />
      </v-col>
    </v-row>
    <div class="text-caption text-medium-emphasis">{{ t(`tunnels.hints.${form.type}`) }}</div>
  </CrudDialog>
</template>
