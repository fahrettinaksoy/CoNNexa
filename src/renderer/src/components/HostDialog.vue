<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import type { Host, Protocol } from '@shared/types'

const props = defineProps<{
  modelValue: boolean
  host?: Host | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()
const vault = useVaultStore()

const defaultPorts: Record<Protocol, number> = {
  ssh: 22,
  telnet: 23,
  local: 0,
  rdp: 3389,
  vnc: 5900,
  serial: 9600
}

const form = ref<Host>(emptyHost())

function emptyHost(): Host {
  return {
    id: '',
    name: '',
    protocol: 'ssh',
    hostname: '',
    port: 22,
    tags: []
  }
}

watch(
  () => props.modelValue,
  (openNow) => {
    if (openNow) form.value = props.host ? { ...props.host } : emptyHost()
  }
)

watch(
  () => form.value.protocol,
  (protocol, prev) => {
    if (form.value.port === defaultPorts[prev]) form.value.port = defaultPorts[protocol]
  }
)

const protocolItems = [
  { title: 'SSH', value: 'ssh' },
  { title: 'Telnet', value: 'telnet' },
  { title: 'VNC', value: 'vnc' },
  { title: 'RDP', value: 'rdp' },
  { title: 'Serial', value: 'serial' }
]

const isSerial = computed(() => form.value.protocol === 'serial')

/** Kimlik alanı gösterilecek protokoller (Telnet/Serial gerektirmez) */
const needsIdentity = computed(
  () => form.value.protocol !== 'telnet' && form.value.protocol !== 'serial'
)

const identityItems = computed(() =>
  vault.identities.map((i) => ({ title: `${i.name} (${i.username})`, value: i.id }))
)

const groupItems = computed(() =>
  vault.groups.map((g) => ({ title: g.name, value: g.id }))
)

const valid = computed(
  () => form.value.name.trim() !== '' && form.value.hostname.trim() !== ''
)

async function save(): Promise<void> {
  await vault.saveHost(form.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card :title="host ? t('hosts.edit') : t('hosts.add')">
      <v-card-text>
        <v-text-field v-model="form.name" :label="t('hosts.name')" density="comfortable" />
        <v-select
          v-model="form.protocol"
          :items="protocolItems"
          :label="t('hosts.protocol')"
          density="comfortable"
        />
        <v-row>
          <v-col cols="8">
            <v-text-field
              v-model="form.hostname"
              :label="isSerial ? t('hosts.devicePath') : t('hosts.hostname')"
              :placeholder="isSerial ? '/dev/tty.usbserial' : ''"
              density="comfortable"
            />
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model.number="form.port"
              :label="isSerial ? t('hosts.baudRate') : t('hosts.port')"
              type="number"
              density="comfortable"
            />
          </v-col>
        </v-row>
        <v-select
          v-if="needsIdentity"
          v-model="form.identityId"
          :items="identityItems"
          :label="t('hosts.identity')"
          :hint="t('hosts.identityInheritHint')"
          persistent-hint
          density="comfortable"
          clearable
        />
        <v-select
          v-model="form.groupId"
          :items="groupItems"
          :label="t('hosts.group')"
          density="comfortable"
          clearable
        />
        <v-text-field
          v-if="form.protocol === 'ssh'"
          v-model="form.startupCommand"
          :label="t('hosts.startupCommand')"
          density="comfortable"
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
