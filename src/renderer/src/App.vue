<script setup lang="ts">
import { onMounted, ref, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useVaultStore } from '@/stores/vault'
import { usePluginsStore } from '@/stores/plugins'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore, type OverlaySheet } from '@/stores/ui'
import { useResponsive } from '@/composables/useResponsive'
import { useAppHotkeys } from '@/composables/useAppHotkeys'
import { useAppLocale } from '@/composables/useAppLocale'
import { useAppTheme } from '@/composables/useAppTheme'
import { keysFor, type ShortcutId } from '@/composables/keymap'
import WorkspaceView from '@/views/WorkspaceView.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import HotkeyHelpDialog from '@/components/HotkeyHelpDialog.vue'
import SideSheet from '@/components/SideSheet.vue'

// İçerik-ağır ikincil paneller yalnızca ilk açılışta yüklenir (lazy).
const TunnelsView = defineAsyncComponent(() => import('@/views/TunnelsView.vue'))
const SyncView = defineAsyncComponent(() => import('@/views/SyncView.vue'))
const TeamsView = defineAsyncComponent(() => import('@/views/TeamsView.vue'))
const SettingsView = defineAsyncComponent(() => import('@/views/SettingsView.vue'))

const { t } = useI18n()
const appLocale = useAppLocale()
const appTheme = useAppTheme()
const ui = useUiStore()
// Platform bayrakları kök `<v-app>` üzerine sınıf olarak basılır; platforma
// özel ince ayarlar (ör. macOS pencere trafik ışıkları için üst boşluk) CSS'ten
// hedeflenebilir.
const { platformClasses } = useResponsive()
const settings = useSettingsStore()
const vault = useVaultStore()
const plugins = usePluginsStore()
const teams = useTeamsStore()
const palette = ref<InstanceType<typeof CommandPalette> | null>(null)

// Uygulama rayı: Çalışma alanı daima temel katmandır; diğerleri onun üzerine
// sağdan kayan side sheet olarak açılır. `sheet: null` → tüm panelleri kapatır.
const navItems: { icon: string; label: string; sheet: OverlaySheet | null; shortcut: ShortcutId }[] = [
  { icon: 'mdi-lan', label: 'nav.workspace', sheet: null, shortcut: 'goWorkspace' },
  { icon: 'mdi-transit-connection-variant', label: 'nav.tunnels', sheet: 'tunnels', shortcut: 'goTunnels' },
  { icon: 'mdi-cloud-sync-outline', label: 'nav.sync', sheet: 'sync', shortcut: 'goSync' },
  { icon: 'mdi-account-group-outline', label: 'nav.teams', sheet: 'teams', shortcut: 'goTeams' }
]

function activate(sheet: OverlaySheet | null): void {
  if (sheet === null) ui.closeSheet()
  else ui.toggleSheet(sheet)
}

// Global kısayollar (her ekranda etkin). Oturum/panel kısayolları çalışma
// alanına özeldir ve WorkspaceView'da kaydedilir.
useAppHotkeys(
  {
    palette: () => palette.value?.toggle(),
    help: () => (ui.helpOpen = !ui.helpOpen),
    settings: () => ui.toggleSheet('settings'),
    goWorkspace: () => ui.closeSheet(),
    goTunnels: () => ui.toggleSheet('tunnels'),
    goSync: () => ui.toggleSheet('sync'),
    goTeams: () => ui.toggleSheet('teams')
  },
  { scope: 'global' }
)

onMounted(() => {
  // Kalıcı dili uygula: vue-i18n + Vuetify bileşenleri + <html lang/dir> tek çağrıda.
  appLocale.apply(settings.locale)
  // Kalıcı tema modunu uygula ('system' ise OS tercihini canlı takip eder).
  appTheme.apply(settings.theme)
  // Vault'u erkenden yükle: komut paleti her ekranda çalışsın
  if (!vault.loaded) vault.load()
  plugins.load()
  teams.load()
})
</script>

<template>
  <v-app :class="platformClasses">
    <!-- Uygulama rayı artık dikey bir drawer değil, yatay bir üst app bar:
         sol panel bundan sonra sadece 2 parçadan oluşur (sekme rayı + liste). -->
    <v-app-bar flat density="comfortable">
      <!-- Bardaki tüm butonlar text, tüm ipuçları alta açılır: tekrarı tek bir
           defaults-provider'da toplarız. -->
      <v-defaults-provider :defaults="{ VBtn: { variant: 'text' }, VTooltip: { location: 'bottom' } }">
        <div class="text-body-1 font-weight-medium ms-4 me-2 flex-shrink-0">{{ t('app.name') }}</div>
        <v-divider vertical inset class="me-1" />
        <div class="d-flex align-center app-bar-nav">
          <template v-for="item in navItems" :key="item.label">
            <v-btn
              :icon="item.icon"
              :active="ui.activeSheet === item.sheet"
              :aria-label="t(item.label)"
              @click="activate(item.sheet)"
            >
              <v-icon :icon="item.icon" />
              <v-tooltip activator="parent">
                <div class="d-flex align-center ga-2">
                  {{ t(item.label) }}
                  <v-hotkey :keys="keysFor(item.shortcut)" />
                </div>
              </v-tooltip>
            </v-btn>
          </template>
        </div>
        <v-spacer />
        <v-btn icon="mdi-magnify" :aria-label="t('palette.open')" @click="palette?.show()">
          <v-icon icon="mdi-magnify" />
          <v-tooltip activator="parent">
            <div class="d-flex align-center ga-2">
              {{ t('palette.open') }}
              <v-hotkey :keys="keysFor('palette')" />
            </div>
          </v-tooltip>
        </v-btn>
        <v-btn icon="mdi-keyboard-outline" :aria-label="t('hotkeys.title')" @click="ui.helpOpen = true">
          <v-icon icon="mdi-keyboard-outline" />
          <v-tooltip activator="parent">
            <div class="d-flex align-center ga-2">
              {{ t('hotkeys.title') }}
              <v-hotkey :keys="keysFor('help')" />
            </div>
          </v-tooltip>
        </v-btn>
        <v-btn
          icon="mdi-cog-outline"
          :active="ui.activeSheet === 'settings'"
          :aria-label="t('nav.settings')"
          class="me-1"
          @click="ui.toggleSheet('settings')"
        >
          <v-icon icon="mdi-cog-outline" />
          <v-tooltip activator="parent">
            <div class="d-flex align-center ga-2">
              {{ t('nav.settings') }}
              <v-hotkey :keys="keysFor('settings')" />
            </div>
          </v-tooltip>
        </v-btn>
      </v-defaults-provider>
    </v-app-bar>

    <v-main>
      <WorkspaceView />
    </v-main>

    <!-- İkincil paneller: çalışma alanının üzerine sağdan kayan side sheet'ler.
         Primary başlık + footer kabuğu SideSheet'te; her panel yalnızca ilk
         açılışta monte edilir (lazy), sonra durumu korunur. -->
    <SideSheet
      :model-value="ui.activeSheet === 'tunnels'"
      :title="t('nav.tunnels')"
      icon="mdi-transit-connection-variant"
      :width="760"
      @update:model-value="(v: boolean) => !v && ui.closeSheet()"
    >
      <TunnelsView v-if="ui.mounted.tunnels" />
    </SideSheet>

    <SideSheet
      :model-value="ui.activeSheet === 'sync'"
      :title="t('nav.sync')"
      icon="mdi-cloud-sync-outline"
      :width="680"
      @update:model-value="(v: boolean) => !v && ui.closeSheet()"
    >
      <SyncView v-if="ui.mounted.sync" />
    </SideSheet>

    <SideSheet
      :model-value="ui.activeSheet === 'teams'"
      :title="t('nav.teams')"
      icon="mdi-account-group-outline"
      :width="720"
      @update:model-value="(v: boolean) => !v && ui.closeSheet()"
    >
      <TeamsView v-if="ui.mounted.teams" />
    </SideSheet>

    <SideSheet
      :model-value="ui.activeSheet === 'settings'"
      :title="t('nav.settings')"
      icon="mdi-cog-outline"
      :width="860"
      @update:model-value="(v: boolean) => !v && ui.closeSheet()"
    >
      <SettingsView v-if="ui.mounted.settings" />
    </SideSheet>

    <CommandPalette ref="palette" />
    <HotkeyHelpDialog v-model="ui.helpOpen" />
  </v-app>
</template>
