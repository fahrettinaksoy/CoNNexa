<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useVaultStore } from '@/stores/vault'
import { usePluginsStore } from '@/stores/plugins'
import { useResponsive } from '@/composables/useResponsive'
import { useAppLocale } from '@/composables/useAppLocale'
import { useAppTheme } from '@/composables/useAppTheme'
import { TERMINAL_THEMES } from '@/composables/terminalThemes'
import { onMounted } from 'vue'
import type { ImportSummary, AlarmConfig } from '@shared/types'

const { t } = useI18n()
const { current: localeModel, locales } = useAppLocale()
const { mode: themeMode, modes: themeModes } = useAppTheme()
const { display, compact, breakpointLabel, platform } = useResponsive()
const settings = useSettingsStore()

// Ayarlar dikey sekmelerle segmentlere ayrılır (MD3 vertical tabs).
const tab = ref('general')

// Aktif platform bayraklarının okunur listesi (yalnızca aktif olanlar).
const activePlatforms = computed(() =>
  (
    [
      ['tauri', '__TAURI_INTERNALS__' in window],
      ['mac', platform.value.mac],
      ['win', platform.value.win],
      ['linux', platform.value.linux],
      ['touch', platform.value.touch]
    ] as const
  )
    .filter(([, on]) => on)
    .map(([name]) => name)
)
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
    cloudMessage.value = { type: 'error', text: summary.error ?? t('importer.failed') }
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
    importError.value = summary.error ?? t('importer.failed')
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

const languages = computed(() => locales.map((l) => ({ title: l.native, value: l.code })))

// Tema önizleme kutuları (VThemeProvider ile scope'lanır).
const themePreviews = [
  { theme: 'light', labelKey: 'settings.themeLight', icon: 'mdi-weather-sunny' },
  { theme: 'dark', labelKey: 'settings.themeDark', icon: 'mdi-weather-night' }
] as const

const terminalThemeItems = TERMINAL_THEMES.map((tt) => ({ title: tt.name, value: tt.id }))
const terminalThemeModel = computed({
  get: () => settings.terminalTheme,
  set: (value: string) => (settings.terminalTheme = value)
})
</script>

<template>
  <div class="d-flex fill-height settings-layout">
    <v-tabs
      v-model="tab"
      direction="vertical"
      color="primary"
      class="settings-nav flex-grow-0 py-2"
    >
      <v-tab value="general" prepend-icon="mdi-tune-variant" :text="t('settings.sections.general')" />
      <v-tab value="importer" prepend-icon="mdi-import" :text="t('settings.sections.importer')" />
      <v-tab value="cloud" prepend-icon="mdi-cloud-outline" :text="t('settings.sections.cloud')" />
      <v-tab value="alarm" prepend-icon="mdi-bell-alert-outline" :text="t('settings.sections.alarm')" />
      <v-tab value="ai" prepend-icon="mdi-robot-outline" :text="t('settings.sections.ai')" />
      <v-tab value="plugins" prepend-icon="mdi-puzzle-outline" :text="t('settings.sections.plugins')" />
      <v-tab value="recording" prepend-icon="mdi-record-circle-outline" :text="t('settings.sections.recording')" />
      <v-tab value="display" prepend-icon="mdi-monitor" :text="t('settings.sections.display')" />
    </v-tabs>

    <v-tabs-window v-model="tab" class="settings-window flex-grow-1 overflow-y-auto pa-4">
      <!-- Genel: dil + tema + terminal şeması -->
      <v-tabs-window-item value="general">
        <v-card class="pa-4">
          <v-select
            v-model="localeModel"
            :items="languages"
            :label="t('settings.language')"
            prepend-inner-icon="mdi-translate"
          />
          <div class="text-caption text-medium-emphasis mb-1">{{ t('settings.theme') }}</div>
      <v-btn-toggle
        v-model="themeMode"
        mandatory
        divided
        color="primary"
        variant="outlined"
        class="mb-4 d-flex"
      >
        <v-btn
          v-for="m in themeModes"
          :key="m.value"
          :value="m.value"
          :prepend-icon="m.icon"
          class="flex-grow-1"
        >
          {{ t(m.labelKey) }}
        </v-btn>
      </v-btn-toggle>
      <!-- Canlı tema önizlemesi: her kutu, genel temadan bağımsız olarak ilgili
           temayı VThemeProvider ile scope'lar; kullanıcı seçmeden iki temayı görür. -->
      <div class="d-flex ga-3 mb-4">
        <v-theme-provider
          v-for="p in themePreviews"
          :key="p.theme"
          :theme="p.theme"
          with-background
          class="theme-preview flex-1-1 rounded-lg pa-3"
        >
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-caption font-weight-medium">{{ t(p.labelKey) }}</span>
            <v-icon :icon="p.icon" size="small" class="text-medium-emphasis" />
          </div>
          <div class="d-flex ga-2 align-center">
            <v-btn size="small" color="primary" variant="flat">Aa</v-btn>
            <v-chip size="small" color="secondary" variant="tonal">chip</v-chip>
            <v-icon icon="mdi-circle" size="small" color="success" />
            <v-icon icon="mdi-circle" size="small" color="error" />
          </div>
        </v-theme-provider>
      </div>
      <v-select
        v-model="terminalThemeModel"
        :items="terminalThemeItems"
        :label="t('settings.terminalTheme')"
        prepend-inner-icon="mdi-palette-outline"
      />
        </v-card>
      </v-tabs-window-item>

      <!-- İçe aktar -->
      <v-tabs-window-item value="importer">
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
      <v-alert v-if="importResult" type="success" class="mt-4">
        {{ importResult }}
      </v-alert>
      <v-alert v-if="importError" type="error" class="mt-4">
        {{ importError }}
      </v-alert>
      <div class="text-caption text-medium-emphasis mt-3">
        {{ t('importer.passwordNote') }}
      </div>
        </v-card>
      </v-tabs-window-item>

      <!-- Bulut envanteri -->
      <v-tabs-window-item value="cloud">
        <v-card class="pa-4">
          <div class="text-body-2 text-medium-emphasis mb-4">{{ t('cloud.description') }}</div>
      <v-select
        v-model="cloudProvider"
        :items="cloudProviderItems"
        :label="t('cloud.provider')"
        prepend-inner-icon="mdi-cloud-outline"
      />
      <v-text-field
        v-model="cloudToken"
        :label="t('cloud.token')"
        type="password"
        autocomplete="off"
      />
      <v-select
        v-model="cloudIdentityId"
        :items="identityItems"
        :label="t('cloud.identity')"
        :hint="t('cloud.identityHint')"
        persistent-hint
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
      <v-alert v-if="cloudMessage" :type="cloudMessage.type" class="mt-4">
        {{ cloudMessage.text }}
      </v-alert>
        </v-card>
      </v-tabs-window-item>

      <!-- Alarmlar -->
      <v-tabs-window-item value="alarm">
        <v-card class="pa-4">
          <div class="text-body-2 text-medium-emphasis mb-4">{{ t('alarm.description') }}</div>
      <v-switch
        v-model="alarm.enabled"
        :label="t('alarm.enabled')"
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
          />
        </v-col>
        <v-col cols="4">
          <v-text-field
            v-model.number="alarm.memPercent"
            :label="t('alarm.mem')"
            type="number"
            suffix="%"
          />
        </v-col>
        <v-col cols="4">
          <v-text-field
            v-model.number="alarm.diskPercent"
            :label="t('alarm.disk')"
            type="number"
            suffix="%"
          />
        </v-col>
      </v-row>
      <v-select
        v-model="alarm.notifyType"
        :items="alarmNotifyItems"
        :label="t('alarm.notifyType')"
      />
      <v-text-field
        v-model="alarm.notifyTarget"
        :label="t('alarm.notifyTarget')"
        :placeholder="alarm.notifyType === 'ntfy' ? 'https://ntfy.sh/my-topic' : 'https://...'"
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
        class="mt-4"
      >
        {{ alarmMessage.text }}
      </v-alert>
        </v-card>
      </v-tabs-window-item>

      <!-- AI asistan -->
      <v-tabs-window-item value="ai">
        <v-card class="pa-4">
          <div class="text-body-2 text-medium-emphasis mb-4">{{ t('ai.description') }}</div>
      <v-text-field
        v-model="aiModel"
        :label="t('ai.model')"
        prepend-inner-icon="mdi-robot-outline"
      />
      <v-text-field
        v-model="aiApiKey"
        :label="t('ai.apiKey')"
        :placeholder="aiHasKey ? '••••••••' : ''"
        type="password"
        autocomplete="off"
      />
      <div class="d-flex justify-end mt-2">
        <v-btn color="primary" variant="tonal" @click="saveAi">{{ t('common.save') }}</v-btn>
      </div>
      <v-alert v-if="aiMessage" type="success" class="mt-4">
        {{ aiMessage }}
      </v-alert>
        </v-card>
      </v-tabs-window-item>

      <!-- Eklentiler -->
      <v-tabs-window-item value="plugins">
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
              :title="t('common.delete')"
              @click="plugins.remove(p.id)"
            />
          </template>
        </v-list-item>
      </v-list>
      <v-alert v-if="plugins.error" type="error" class="mt-3">
        {{ plugins.error }}
      </v-alert>
        </v-card>
      </v-tabs-window-item>

      <!-- Kayıtlar -->
      <v-tabs-window-item value="recording">
        <v-card class="pa-4">
          <v-btn
            variant="tonal"
            prepend-icon="mdi-folder-play-outline"
            @click="openRecordings"
          >
            {{ t('recording.openFolder') }}
          </v-btn>
        </v-card>
      </v-tabs-window-item>

      <!-- Görüntü / responsive -->
      <v-tabs-window-item value="display">
        <v-card class="pa-4">
          <div class="text-body-2 text-medium-emphasis mb-4">{{ t('display.description') }}</div>
      <v-list class="py-0 bg-transparent">
        <v-list-item :title="t('display.breakpoint')" prepend-icon="mdi-monitor-screenshot">
          <template #append>
            <span class="text-mono text-medium-emphasis">{{ breakpointLabel }}</span>
          </template>
        </v-list-item>
        <v-list-item :title="t('display.layoutMode')" prepend-icon="mdi-view-column-outline">
          <template #append>
            <v-chip size="small" :color="compact ? 'warning' : 'primary'" variant="tonal">
              {{ compact ? t('display.compact') : t('display.expanded') }}
            </v-chip>
          </template>
        </v-list-item>
        <v-list-item :title="t('display.mobileBreakpoint')" prepend-icon="mdi-cellphone-arrow-down">
          <template #append>
            <span class="text-mono text-medium-emphasis">
              {{ display.mobileBreakpoint.value }}
            </span>
          </template>
        </v-list-item>
        <v-list-item :title="t('display.platform')" prepend-icon="mdi-chip">
          <template #append>
            <div class="d-flex ga-1 flex-wrap justify-end">
              <v-chip
                v-for="name in activePlatforms"
                :key="name"
                size="x-small"
                variant="tonal"
              >
                {{ name }}
              </v-chip>
            </div>
          </template>
        </v-list-item>
      </v-list>
          <div class="text-caption text-medium-emphasis mt-2">{{ t('display.hint') }}</div>
        </v-card>
      </v-tabs-window-item>
    </v-tabs-window>
  </div>
</template>

<style scoped>
/* Dikey tab yerleşimi: sol sekme rayı sabit, sağ içerik kendi içinde kayar. */
.settings-layout {
  min-height: 0;
}
.settings-nav {
  min-width: 176px;
  background: rgb(var(--v-theme-surface-light));
}
.settings-nav :deep(.v-tab) {
  justify-content: flex-start;
  text-transform: none;
  letter-spacing: normal;
}
.settings-window {
  min-height: 0;
}
.text-mono {
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 0.8125rem;
}
.theme-preview {
  /* MD3: sert kenarlık yok. Kutu, önizlediği temanın kendi arkaplanını taşır
     (with-background); yumuşak bir yükseltme gölgesiyle "kart" gibi ayrışır. */
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.08),
    0 3px 12px rgba(15, 23, 42, 0.08);
}
</style>
