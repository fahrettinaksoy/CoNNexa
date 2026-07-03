<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { hostActionsKey } from '@/composables/hostActions'
import HostListItem from './HostListItem.vue'

const props = defineProps<{ groupId?: string }>()

const { t } = useI18n()
const vault = useVaultStore()
const actions = inject(hostActionsKey)!

const childGroups = computed(() => vault.groupsByParent.get(props.groupId) ?? [])
const hosts = computed(() => vault.hosts.filter((h) => h.groupId === props.groupId))
</script>

<template>
  <v-list-group v-for="group in childGroups" :key="group.id" :value="group.id">
    <template #activator="{ props: activatorProps }">
      <v-list-item v-bind="activatorProps" :title="group.name">
        <template #prepend>
          <v-icon icon="mdi-folder-outline" size="small" />
        </template>
        <template #append>
          <v-icon
            v-if="group.identityId"
            icon="mdi-account-key"
            size="x-small"
            class="mr-1 text-medium-emphasis"
            :title="t('groups.hasDefaultIdentity', { name: vault.identityName(group.identityId) })"
          />
          <v-menu>
            <template #activator="{ props: menuProps }">
              <v-btn
                icon="mdi-dots-vertical"
                size="x-small"
                variant="text"
                v-bind="menuProps"
                @click.stop
              />
            </template>
            <v-list density="compact">
              <v-list-item :title="t('groups.edit')" @click="actions.editGroup(group)" />
              <v-list-item :title="t('groups.addSub')" @click="actions.addGroup(group.id)" />
              <v-list-item
                :title="t('common.delete')"
                base-color="error"
                @click="vault.deleteGroup(group.id)"
              />
            </v-list>
          </v-menu>
        </template>
      </v-list-item>
    </template>
    <HostTreeNode :group-id="group.id" />
  </v-list-group>

  <HostListItem v-for="host in hosts" :key="host.id" :host="host" />
</template>
