<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import type { SyncBackend, SyncConfigPublic, SyncResult } from '@shared/types'

const { t } = useI18n()
const vault = useVaultStore()

const config = ref<SyncConfigPublic>({
  backend: 'none',
  hasGistToken: false,
  hasWebdavPassword: false
})

// Form alanları
const backend = ref<SyncBackend>('none')
const gistToken = ref('')
const gistId = ref('')
const webdavUrl = ref('')
const webdavUsername = ref('')
const webdavPassword = ref('')
const passphrase = ref('')

const busy = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

async function loadConfig(): Promise<void> {
  config.value = await window.connexa.sync.getConfig()
  backend.value = config.value.backend
  gistId.value = config.value.gistId ?? ''
  webdavUrl.value = config.value.webdavUrl ?? ''
  webdavUsername.value = config.value.webdavUsername ?? ''
}

onMounted(loadConfig)

const backendItems = computed(() => [
  { title: t('sync.backends.none'), value: 'none' },
  { title: t('sync.backends.gist'), value: 'gist' },
  { title: t('sync.backends.webdav'), value: 'webdav' }
])

async function saveConfig(): Promise<void> {
  await window.connexa.sync.saveConfig({
    backend: backend.value,
    gistToken: gistToken.value || undefined,
    gistId: gistId.value || undefined,
    webdavUrl: webdavUrl.value || undefined,
    webdavUsername: webdavUsername.value || undefined,
    webdavPassword: webdavPassword.value || undefined
  })
  gistToken.value = ''
  webdavPassword.value = ''
  await loadConfig()
  message.value = { type: 'success', text: t('sync.configSaved') }
}

function report(result: SyncResult, successText: string): void {
  if (result.ok) message.value = { type: 'success', text: successText }
  else message.value = { type: 'error', text: result.error ?? 'error' }
}

async function push(): Promise<void> {
  busy.value = true
  message.value = null
  const result = await window.connexa.sync.push(passphrase.value)
  busy.value = false
  report(result, t('sync.pushDone'))
  if (result.ok) await loadConfig()
}

async function pull(): Promise<void> {
  busy.value = true
  message.value = null
  const result = await window.connexa.sync.pull(passphrase.value)
  busy.value = false
  if (result.ok) {
    await vault.load()
    report(result, t('sync.pullDone', { hosts: result.summary?.hosts ?? 0 }))
  } else {
    report(result, '')
  }
}

const canSync = computed(
  () => config.value.backend !== 'none' && passphrase.value.length > 0
)
</script>

<template>
  <div class="pa-4">
    <p class="text-body-2 text-medium-emphasis mb-4">{{ t('sync.description') }}</p>

    <v-card class="pa-4 mb-6">
      <div class="text-subtitle-2 mb-3">{{ t('sync.backend') }}</div>
      <v-select
        v-model="backend"
        :items="backendItems"
        prepend-inner-icon="mdi-cloud-cog-outline"
      />

      <template v-if="backend === 'gist'">
        <v-text-field
          v-model="gistToken"
          :label="t('sync.gistToken')"
          :placeholder="config.hasGistToken ? '••••••••' : ''"
          type="password"
          autocomplete="off"
        />
        <v-text-field
          v-model="gistId"
          :label="t('sync.gistId')"
          :hint="t('sync.gistIdHint')"
          persistent-hint
        />
      </template>

      <template v-else-if="backend === 'webdav'">
        <v-text-field
          v-model="webdavUrl"
          :label="t('sync.webdavUrl')"
          placeholder="https://dav.example.com/connexa/"
        />
        <v-text-field
          v-model="webdavUsername"
          :label="t('sync.webdavUsername')"
          autocomplete="off"
        />
        <v-text-field
          v-model="webdavPassword"
          :label="t('sync.webdavPassword')"
          :placeholder="config.hasWebdavPassword ? '••••••••' : ''"
          type="password"
          autocomplete="off"
        />
      </template>

      <div class="d-flex justify-end mt-2">
        <v-btn variant="tonal" @click="saveConfig">{{ t('common.save') }}</v-btn>
      </div>
    </v-card>

    <v-card class="pa-4">
      <div class="text-subtitle-2 mb-1">{{ t('sync.passphrase') }}</div>
      <div class="text-caption text-medium-emphasis mb-3">{{ t('sync.passphraseHint') }}</div>
      <v-text-field
        v-model="passphrase"
        :label="t('sync.passphrase')"
        type="password"
        prepend-inner-icon="mdi-key"
        autocomplete="off"
      />
      <div class="d-flex ga-2">
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-cloud-upload"
          :disabled="!canSync"
          :loading="busy"
          @click="push"
        >
          {{ t('sync.push') }}
        </v-btn>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-cloud-download"
          :disabled="!canSync"
          :loading="busy"
          @click="pull"
        >
          {{ t('sync.pull') }}
        </v-btn>
      </div>
      <v-alert v-if="message" :type="message.type" class="mt-4">
        {{ message.text }}
      </v-alert>
      <div class="text-caption text-medium-emphasis mt-4">
        <v-icon icon="mdi-shield-lock-outline" size="small" class="mr-1" />
        {{ t('sync.zeroKnowledge') }}
      </div>
    </v-card>
  </div>
</template>
