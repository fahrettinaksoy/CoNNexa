<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { useRules } from '@/composables/rules'
import CrudDialog from '@/components/CrudDialog.vue'
import type { Host, Protocol } from '@shared/types'

const model = defineModel<boolean>({ default: false })
const props = defineProps<{ host?: Host | null }>()

const { t } = useI18n()
const vault = useVaultStore()
const { required, port, positiveInt } = useRules()

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

watch(model, (openNow) => {
  if (openNow) form.value = props.host ? { ...props.host } : emptyHost()
})

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

async function save(): Promise<void> {
  await vault.saveHost(form.value)
  model.value = false
}
</script>

<template>
  <CrudDialog
    v-model="model"
    :title="host ? t('hosts.edit') : t('hosts.add')"
    @save="save"
  >
    <v-text-field v-model="form.name" :label="t('hosts.name')" :rules="[required]" autofocus />
        <v-select
          v-model="form.protocol"
          :items="protocolItems"
          :label="t('hosts.protocol')"
        />
        <v-row>
          <v-col cols="8">
            <v-text-field
              v-model="form.hostname"
              :label="isSerial ? t('hosts.devicePath') : t('hosts.hostname')"
              :placeholder="isSerial ? '/dev/tty.usbserial' : ''"
              :rules="[required]"
            />
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model.number="form.port"
              :label="isSerial ? t('hosts.baudRate') : t('hosts.port')"
              type="number"
              :rules="isSerial ? [positiveInt] : [port]"
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
          clearable
        />
        <v-select
          v-model="form.groupId"
          :items="groupItems"
          :label="t('hosts.group')"
          clearable
        />
        <v-text-field
          v-if="form.protocol === 'ssh'"
          v-model="form.startupCommand"
          :label="t('hosts.startupCommand')"
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
