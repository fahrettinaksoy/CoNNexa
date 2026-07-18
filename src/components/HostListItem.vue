<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { useTeamsStore } from '@/stores/teams'
import { hostActionsKey } from '@/composables/hostActions'
import { protocolIcon } from '@/plugins/icons'
import type { Host } from '@shared/types'

const props = defineProps<{ host: Host }>()

const { t } = useI18n()
const vault = useVaultStore()
const teams = useTeamsStore()
const actions = inject(hostActionsKey)!

async function assignTeam(teamId: string | null): Promise<void> {
  await window.connexa.team.assign('host', props.host.id, teamId)
  await vault.load()
}

</script>

<template>
  <v-list-item
    :title="host.name"
    :subtitle="`${host.hostname}:${host.port}`"
    @dblclick="actions.connect(host)"
  >
    <template #prepend>
      <v-icon :icon="protocolIcon(host.protocol)" :color="host.color" size="small" />
    </template>
    <template #append>
      <v-icon
        v-if="host.teamVaultId"
        icon="mdi-account-group"
        size="x-small"
        class="mr-1 text-medium-emphasis"
        :title="teams.teamName(host.teamVaultId)"
      />
      <v-btn
        icon="mdi-connection"
        size="x-small"
        variant="text"
        :title="t('hosts.connect')"
        @click.stop="actions.connect(host)"
      />
      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn
            icon="mdi-dots-vertical"
            size="x-small"
            variant="text"
            :title="t('common.more')"
            v-bind="menuProps"
          />
        </template>
        <v-list>
          <v-list-item :title="t('hosts.edit')" @click="actions.editHost(host)" />
          <v-list-item
            v-if="host.protocol === 'rdp'"
            :title="t('hosts.externalRdp')"
            prepend-icon="mdi-open-in-new"
            @click="actions.launchExternalRdp(host)"
          />
          <v-menu v-if="teams.teams.length > 0" location="end" open-on-hover>
            <template #activator="{ props: subProps }">
              <v-list-item
                v-bind="subProps"
                :title="t('teams.assign')"
                prepend-icon="mdi-account-group-outline"
                append-icon="mdi-menu-right"
              />
            </template>
            <v-list>
              <v-list-item
                v-for="tv in teams.teams"
                :key="tv.id"
                :title="tv.name"
                :active="host.teamVaultId === tv.id"
                @click="assignTeam(tv.id)"
              />
              <v-divider v-if="host.teamVaultId" />
              <v-list-item
                v-if="host.teamVaultId"
                :title="t('teams.unassign')"
                base-color="error"
                @click="assignTeam(null)"
              />
            </v-list>
          </v-menu>
          <v-list-item
            :title="t('hosts.delete')"
            base-color="error"
            @click="vault.deleteHost(host.id)"
          />
        </v-list>
      </v-menu>
    </template>
  </v-list-item>
</template>
