<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { useTunnelsStore } from '@/stores/tunnels'
import TunnelDialog from '@/components/TunnelDialog.vue'
import type { Tunnel } from '@shared/types'

const { t } = useI18n()
const vault = useVaultStore()
const tunnels = useTunnelsStore()

const dialog = ref(false)
const editing = ref<Tunnel | null>(null)
const errorMsg = ref<string | null>(null)

onMounted(() => {
  if (!vault.loaded) vault.load()
  tunnels.init()
})

const typeLabel: Record<string, string> = {
  local: 'L',
  remote: 'R',
  dynamic: 'D'
}

function add(): void {
  editing.value = null
  dialog.value = true
}

function edit(tunnel: Tunnel): void {
  editing.value = tunnel
  dialog.value = true
}

async function toggle(tunnel: Tunnel): Promise<void> {
  if (tunnels.isRunning(tunnel.id)) {
    await tunnels.stop(tunnel.id)
  } else {
    const error = await tunnels.start(tunnel.id)
    if (error) errorMsg.value = `${tunnel.name}: ${error}`
  }
}

async function remove(tunnel: Tunnel): Promise<void> {
  await window.connexa.vault.deleteTunnel(tunnel.id)
  await vault.load()
}

function hostName(hostId: string): string {
  return vault.hosts.find((h) => h.id === hostId)?.name ?? '—'
}

function route(tunnel: Tunnel): string {
  const listen = `${tunnel.listenHost}:${tunnel.listenPort}`
  if (tunnel.type === 'dynamic') return `${listen} (SOCKS5)`
  return `${listen} → ${tunnel.destHost}:${tunnel.destPort}`
}
</script>

<template>
  <v-container>
    <div class="d-flex align-center mb-4">
      <h2 class="text-h5">{{ t('tunnels.title') }}</h2>
      <v-spacer />
      <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" @click="add">
        {{ t('tunnels.add') }}
      </v-btn>
    </div>

    <v-card v-if="vault.tunnels.length === 0" class="pa-8 text-center text-medium-emphasis">
      {{ t('tunnels.empty') }}
    </v-card>

    <v-table v-else>
      <thead>
        <tr>
          <th style="width: 40px"></th>
          <th>{{ t('tunnels.name') }}</th>
          <th style="width: 60px">{{ t('tunnels.type') }}</th>
          <th>{{ t('tunnels.host') }}</th>
          <th>{{ t('tunnels.route') }}</th>
          <th style="width: 120px" class="text-right"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tunnel in vault.tunnels" :key="tunnel.id">
          <td>
            <v-icon
              :icon="tunnels.isRunning(tunnel.id) ? 'mdi-circle' : 'mdi-circle-outline'"
              :color="tunnels.isRunning(tunnel.id) ? 'success' : 'grey'"
              size="x-small"
            />
          </td>
          <td>{{ tunnel.name }}</td>
          <td>
            <v-chip size="x-small" label>{{ typeLabel[tunnel.type] }}</v-chip>
          </td>
          <td>{{ hostName(tunnel.hostId) }}</td>
          <td class="text-caption">{{ route(tunnel) }}</td>
          <td class="text-right">
            <v-btn
              :icon="tunnels.isRunning(tunnel.id) ? 'mdi-stop' : 'mdi-play'"
              :color="tunnels.isRunning(tunnel.id) ? 'error' : 'success'"
              size="small"
              variant="text"
              :loading="tunnels.busy"
              :title="tunnels.isRunning(tunnel.id) ? t('tunnels.stop') : t('tunnels.start')"
              @click="toggle(tunnel)"
            />
            <v-btn
              icon="mdi-pencil"
              size="small"
              variant="text"
              :title="t('tunnels.edit')"
              @click="edit(tunnel)"
            />
            <v-btn
              icon="mdi-delete-outline"
              size="small"
              variant="text"
              @click="remove(tunnel)"
            />
          </td>
        </tr>
      </tbody>
    </v-table>

    <TunnelDialog v-model="dialog" :tunnel="editing" />

    <v-snackbar
      :model-value="errorMsg !== null"
      color="error"
      timeout="6000"
      @update:model-value="errorMsg = null"
    >
      {{ errorMsg }}
    </v-snackbar>
  </v-container>
</template>
