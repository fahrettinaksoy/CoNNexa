<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from 'vuetify'
import { useSettingsStore } from '@/stores/settings'
import { useVaultStore } from '@/stores/vault'
import { usePluginsStore } from '@/stores/plugins'
import { TERMINAL_THEMES } from '@/composables/terminalThemes'
import { onMounted } from 'vue'
import type { ImportSummary, AlarmConfig } from '@shared/types'

const { t, locale } = useI18n()
const theme = useTheme()
const settings = useSettingsStore()
const vault = useVaultStore()
const plugins = usePluginsStore()

onMounted(() => plugins.load())

const importing = ref(false)
const importResult = ref<string | null>(null)
const importError = ref<string | null>(null)

function openRecordings(): void {
  window.connexa.recording.openFolder()
}

// AI asistan
const aiModel = ref('claude-opus-4-8')
const aiApiKey = ref('')
const aiHasKey = ref(false)
const aiMessage = ref<string | null>(null)

onMounted(async () => {
  const cfg = await window.connexa.ai.getConfig()
  aiModel.value = cfg.model
  aiHasKey.value = cfg.hasApiKey
})

async function saveAi(): Promise<void> {
  await window.connexa.ai.saveConfig({
    model: aiModel.value,
    apiKey: aiApiKey.value || undefined
  })
  aiApiKey.value = ''
  const cfg = await window.connexa.ai.getConfig()
  aiHasKey.value = cfg.hasApiKey
  aiMessage.value = t('ai.saved')
}

// Bulut envanteri
const cloudProvider = ref<'digitalocean' | 'hetzner'>('digitalocean')
const cloudToken = ref('')
const cloudIdentityId = ref<string | undefined>(undefined)
const cloudBusy = ref(false)
const cloudMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const cloudProviderItems = [
  { title: 'DigitalOcean', value: 'digitalocean' },
  { title: 'Hetzner Cloud', value: 'hetzner' }
]

const identityItems = computed(() =>
  vault.identities.map((i) => ({ title: `${i.name} (${i.username})`, value: i.id }))
)

// Alarmlar
const alarm = ref<AlarmConfig>({
  enabled: false,
  cpuPercent: 90,
  memPercent: 90,
  diskPercent: 90,
  notifyType: 'ntfy',
  notifyTarget: ''
})
const alarmMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const alarmNotifyItems = [
  { title: 'ntfy', value: 'ntfy' },
  { title: 'Webhook', value: 'webhook' }
]

onMounted(async () => {
  alarm.value = await window.connexa.alarm.getConfig()
})

async function saveAlarm(): Promise<void> {
  await window.connexa.alarm.saveConfig(JSON.parse(JSON.stringify(alarm.value)))
  alarmMessage.value = { type: 'success', text: t('alarm.saved') }
}

async function testAlarm(): Promise<void> {
  alarmMessage.value = null
  const result = await window.connexa.alarm.test(JSON.parse(JSON.stringify(alarm.value)))
  alarmMessage.value = result.ok
    ? { type: 'success', text: t('alarm.testSent') }
    : { type: 'error', text: result.error ?? 'error' }
}

async function importCloud(): Promise<void> {
  cloudBusy.value = true
  cloudMessage.value = null
  const summary = await window.connexa.cloud.import(
    cloudProvider.value,
    cloudToken.value,
    cloudIdentityId.value
  )
  cloudBusy.value = false
  if (!summary.ok) {
    cloudMessage.value = { type: 'error', text: summary.error ?? 'Import failed' }
    return
  }
  cloudToken.value = ''
  cloudMessage.value = {
    type: 'success',
    text: t('importer.summary', {
      hosts: summary.hosts,
      identities: summary.identities,
      groups: summary.groups,
      skipped: summary.skipped
    })
  }
  await vault.load()
}

async function runImport(kind: 'sshConfig' | 'mremoteng' | 'termius'): Promise<void> {
  importing.value = true
  importResult.value = null
  importError.value = null
  const summary: ImportSummary = await window.connexa.importer[kind]()
  importing.value = false
  if (summary.canceled) return
  if (!summary.ok) {
    importError.value = summary.error ?? 'Import failed'
    return
  }
  importResult.value = t('importer.summary', {
    hosts: summary.hosts,
    identities: summary.identities,
    groups: summary.groups,
    skipped: summary.skipped
  })
  await vault.load()
}

const localeModel = computed({
  get: () => settings.locale,
  set: (value: string) => {
    settings.locale = value
    locale.value = value
  }
})

const themeModel = computed({
  get: () => settings.theme,
  set: (value: string) => {
    settings.theme = value
    theme.change(value)
  }
})

const languages = [
  { title: 'Türkçe', value: 'tr' },
  { title: 'English', value: 'en' }
]

const themes = computed(() => [
  { title: t('settings.themeDark'), value: 'dark' },
  { title: t('settings.themeLight'), value: 'light' }
])

const terminalThemeItems = TERMINAL_THEMES.map((tt) => ({ title: tt.name, value: tt.id }))
const terminalThemeModel = computed({
  get: () => settings.terminalTheme,
  set: (value: string) => (settings.terminalTheme = value)
})
</script>

<template>
  <v-container max-width="640">
    <h2 class="text-h5 mb-6">{{ t('settings.title') }}</h2>
    <v-card class="pa-4">
      <v-select
        v-model="localeModel"
        :items="languages"
        :label="t('settings.language')"
        density="comfortable"
        prepend-inner-icon="mdi-translate"
      />
      <v-select
        v-model="themeModel"
        :items="themes"
        :label="t('settings.theme')"
        density="comfortable"
        prepend-inner-icon="mdi-theme-light-dark"
      />
      <v-select
        v-model="terminalThemeModel"
        :items="terminalThemeItems"
        :label="t('settings.terminalTheme')"
        density="comfortable"
        prepend-inner-icon="mdi-palette-outline"
      />
    </v-card>

    <h3 class="text-h6 mt-8 mb-4">{{ t('importer.title') }}</h3>
    <v-card class="pa-4">
      <div class="text-body-2 text-medium-emphasis mb-4">{{ t('importer.description') }}</div>
      <div class="d-flex flex-wrap ga-2">
        <v-btn
          variant="tonal"
          prepend-icon="mdi-console-network"
          :loading="importing"
          @click="runImport('sshConfig')"
        >
          {{ t('importer.sshConfig') }}
        </v-btn>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-file-xml-box"
          :loading="importing"
          @click="runImport('mremoteng')"
        >
          {{ t('importer.mremoteng') }}
        </v-btn>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-code-json"
          :loading="importing"
          @click="runImport('termius')"
        >
          {{ t('importer.termius') }}
        </v-btn>
      </div>
      <v-alert v-if="importResult" type="success" variant="tonal" class="mt-4" density="compact">
        {{ importResult }}
      </v-alert>
      <v-alert v-if="importError" type="error" variant="tonal" class="mt-4" density="compact">
        {{ importError }}
      </v-alert>
      <div class="text-caption text-medium-emphasis mt-3">
        {{ t('importer.passwordNote') }}
      </div>
    </v-card>

    <h3 class="text-h6 mt-8 mb-4">{{ t('cloud.title') }}</h3>
    <v-card class="pa-4">
      <div class="text-body-2 text-medium-emphasis mb-4">{{ t('cloud.description') }}</div>
      <v-select
        v-model="cloudProvider"
        :items="cloudProviderItems"
        :label="t('cloud.provider')"
        density="comfortable"
        prepend-inner-icon="mdi-cloud-outline"
      />
      <v-text-field
        v-model="cloudToken"
        :label="t('cloud.token')"
        type="password"
        density="comfortable"
        autocomplete="off"
      />
      <v-select
        v-model="cloudIdentityId"
        :items="identityItems"
        :label="t('cloud.identity')"
        :hint="t('cloud.identityHint')"
        persistent-hint
        density="comfortable"
        clearable
      />
      <div class="d-flex justify-end mt-3">
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-cloud-download-outline"
          :loading="cloudBusy"
          :disabled="!cloudToken"
          @click="importCloud"
        >
          {{ t('cloud.import') }}
        </v-btn>
      </div>
      <v-alert
        v-if="cloudMessage"
        :type="cloudMessage.type"
        variant="tonal"
        density="compact"
        class="mt-4"
      >
        {{ cloudMessage.text }}
      </v-alert>
    </v-card>

    <h3 class="text-h6 mt-8 mb-4">{{ t('alarm.title') }}</h3>
    <v-card class="pa-4">
      <div class="text-body-2 text-medium-emphasis mb-4">{{ t('alarm.description') }}</div>
      <v-switch
        v-model="alarm.enabled"
        :label="t('alarm.enabled')"
        color="primary"
        density="comfortable"
        hide-details
        class="mb-2"
      />
      <v-row>
        <v-col cols="4">
          <v-text-field
            v-model.number="alarm.cpuPercent"
            :label="t('alarm.cpu')"
            type="number"
            suffix="%"
            density="comfortable"
          />
        </v-col>
        <v-col cols="4">
          <v-text-field
            v-model.number="alarm.memPercent"
            :label="t('alarm.mem')"
            type="number"
            suffix="%"
            density="comfortable"
          />
        </v-col>
        <v-col cols="4">
          <v-text-field
            v-model.number="alarm.diskPercent"
            :label="t('alarm.disk')"
            type="number"
            suffix="%"
            density="comfortable"
          />
        </v-col>
      </v-row>
      <v-select
        v-model="alarm.notifyType"
        :items="alarmNotifyItems"
        :label="t('alarm.notifyType')"
        density="comfortable"
      />
      <v-text-field
        v-model="alarm.notifyTarget"
        :label="t('alarm.notifyTarget')"
        :placeholder="alarm.notifyType === 'ntfy' ? 'https://ntfy.sh/my-topic' : 'https://...'"
        density="comfortable"
      />
      <div class="d-flex ga-2 justify-end mt-2">
        <v-btn variant="text" :disabled="!alarm.notifyTarget" @click="testAlarm">
          {{ t('alarm.test') }}
        </v-btn>
        <v-btn color="primary" variant="tonal" @click="saveAlarm">{{ t('common.save') }}</v-btn>
      </div>
      <v-alert
        v-if="alarmMessage"
        :type="alarmMessage.type"
        variant="tonal"
        density="compact"
        class="mt-4"
      >
        {{ alarmMessage.text }}
      </v-alert>
    </v-card>

    <h3 class="text-h6 mt-8 mb-4">{{ t('ai.settings') }}</h3>
    <v-card class="pa-4">
      <div class="text-body-2 text-medium-emphasis mb-4">{{ t('ai.description') }}</div>
      <v-text-field
        v-model="aiModel"
        :label="t('ai.model')"
        density="comfortable"
        prepend-inner-icon="mdi-robot-outline"
      />
      <v-text-field
        v-model="aiApiKey"
        :label="t('ai.apiKey')"
        :placeholder="aiHasKey ? '••••••••' : ''"
        type="password"
        density="comfortable"
        autocomplete="off"
      />
      <div class="d-flex justify-end mt-2">
        <v-btn color="primary" variant="tonal" @click="saveAi">{{ t('common.save') }}</v-btn>
      </div>
      <v-alert v-if="aiMessage" type="success" variant="tonal" density="compact" class="mt-4">
        {{ aiMessage }}
      </v-alert>
    </v-card>

    <h3 class="text-h6 mt-8 mb-4">{{ t('plugins.title') }}</h3>
    <v-card class="pa-4">
      <div class="text-body-2 text-medium-emphasis mb-4">{{ t('plugins.description') }}</div>
      <div class="d-flex ga-2 mb-3">
        <v-btn variant="tonal" prepend-icon="mdi-puzzle-plus-outline" @click="plugins.install">
          {{ t('plugins.install') }}
        </v-btn>
        <v-btn variant="text" prepend-icon="mdi-folder-outline" @click="plugins.openFolder">
          {{ t('plugins.openFolder') }}
        </v-btn>
      </div>
      <div v-if="plugins.plugins.length === 0" class="text-caption text-medium-emphasis">
        {{ t('plugins.empty') }}
      </div>
      <v-list v-else density="compact" class="py-0">
        <v-list-item
          v-for="p in plugins.plugins"
          :key="p.id"
          :title="`${p.name} · v${p.version}`"
          :subtitle="p.description || t('plugins.snippetCount', { count: p.snippetCount })"
          prepend-icon="mdi-puzzle-outline"
        >
          <template #append>
            <v-btn
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              @click="plugins.remove(p.id)"
            />
          </template>
        </v-list-item>
      </v-list>
      <v-alert v-if="plugins.error" type="error" variant="tonal" density="compact" class="mt-3">
        {{ plugins.error }}
      </v-alert>
    </v-card>

    <h3 class="text-h6 mt-8 mb-4">{{ t('recording.folder') }}</h3>
    <v-card class="pa-4">
      <v-btn
        variant="tonal"
        prepend-icon="mdi-folder-play-outline"
        @click="openRecordings"
      >
        {{ t('recording.openFolder') }}
      </v-btn>
    </v-card>
  </v-container>
</template>
