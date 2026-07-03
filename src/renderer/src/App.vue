<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from 'vuetify'
import { useSettingsStore } from '@/stores/settings'
import { useVaultStore } from '@/stores/vault'
import { usePluginsStore } from '@/stores/plugins'
import { useTeamsStore } from '@/stores/teams'
import CommandPalette from '@/components/CommandPalette.vue'

const { t, locale } = useI18n()
const theme = useTheme()
const settings = useSettingsStore()
const vault = useVaultStore()
const plugins = usePluginsStore()
const teams = useTeamsStore()
const palette = ref<InstanceType<typeof CommandPalette> | null>(null)

onMounted(() => {
  locale.value = settings.locale
  theme.change(settings.theme)
  // Vault'u erkenden yükle: komut paleti her ekranda çalışsın
  if (!vault.loaded) vault.load()
  plugins.load()
  teams.load()
})
</script>

<template>
  <v-app>
    <v-navigation-drawer rail permanent>
      <div class="d-flex flex-column align-center py-2 fill-height">
        <v-btn
          icon="mdi-lan"
          variant="text"
          :title="t('nav.workspace')"
          :to="{ name: 'workspace' }"
        />
        <v-btn
          icon="mdi-transit-connection-variant"
          variant="text"
          :title="t('nav.tunnels')"
          :to="{ name: 'tunnels' }"
        />
        <v-btn
          icon="mdi-cloud-sync-outline"
          variant="text"
          :title="t('nav.sync')"
          :to="{ name: 'sync' }"
        />
        <v-btn
          icon="mdi-account-group-outline"
          variant="text"
          :title="t('nav.teams')"
          :to="{ name: 'teams' }"
        />
        <v-spacer />
        <v-btn
          icon="mdi-magnify"
          variant="text"
          :title="t('palette.open')"
          @click="palette?.show()"
        />
        <v-btn
          icon="mdi-cog-outline"
          variant="text"
          :title="t('nav.settings')"
          :to="{ name: 'settings' }"
        />
      </div>
    </v-navigation-drawer>

    <v-main>
      <router-view v-slot="{ Component }">
        <keep-alive include="WorkspaceView">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </v-main>

    <CommandPalette ref="palette" />
  </v-app>
</template>
