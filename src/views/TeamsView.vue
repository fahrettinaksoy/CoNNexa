<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTeamsStore } from '@/stores/teams'
import { useVaultStore } from '@/stores/vault'
import { useRules } from '@/composables/rules'
import CrudDialog from '@/components/CrudDialog.vue'
import type { TeamVaultPublic, TeamVaultInput } from '@shared/types'

const { t } = useI18n()
const teams = useTeamsStore()
const vault = useVaultStore()
const { required } = useRules()

const dialog = ref(false)
const editing = ref<TeamVaultPublic | null>(null)
const form = ref<TeamVaultInput>(emptyForm())
const passphrase = ref<Record<string, string>>({})
const busy = ref<string | null>(null)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

function emptyForm(): TeamVaultInput {
  return { name: '', backend: 'gist' }
}

onMounted(() => {
  teams.load(true)
  if (!vault.loaded) vault.load()
})

const backendItems = [
  { title: 'GitHub Gist', value: 'gist' },
  { title: 'WebDAV', value: 'webdav' }
]

function add(): void {
  editing.value = null
  form.value = emptyForm()
  dialog.value = true
}

function edit(tv: TeamVaultPublic): void {
  editing.value = tv
  form.value = {
    id: tv.id,
    name: tv.name,
    backend: tv.backend,
    gistId: tv.gistId,
    webdavUrl: tv.webdavUrl,
    webdavUsername: tv.webdavUsername
  }
  dialog.value = true
}

async function save(): Promise<void> {
  await window.connexa.team.save(JSON.parse(JSON.stringify(form.value)))
  dialog.value = false
  await teams.load(true)
}

async function remove(tv: TeamVaultPublic): Promise<void> {
  await window.connexa.team.delete(tv.id)
  await teams.load(true)
  await vault.load()
}

async function push(tv: TeamVaultPublic): Promise<void> {
  busy.value = tv.id
  message.value = null
  const result = await window.connexa.team.push(tv.id, passphrase.value[tv.id] ?? '')
  busy.value = null
  if (result.ok) {
    message.value = { type: 'success', text: t('teams.pushDone', { name: tv.name }) }
    await teams.load(true)
  } else {
    message.value = { type: 'error', text: result.error ?? 'error' }
  }
}

async function pull(tv: TeamVaultPublic): Promise<void> {
  busy.value = tv.id
  message.value = null
  const result = await window.connexa.team.pull(tv.id, passphrase.value[tv.id] ?? '')
  busy.value = null
  if (result.ok) {
    await vault.load()
    message.value = {
      type: 'success',
      text: t('teams.pullDone', { hosts: result.summary?.hosts ?? 0 })
    }
  } else {
    message.value = { type: 'error', text: result.error ?? 'error' }
  }
}

function memberCount(teamId: string): number {
  return (
    vault.hosts.filter((h) => h.teamVaultId === teamId).length +
    vault.snippets.filter((s) => s.teamVaultId === teamId).length +
    vault.groups.filter((g) => g.teamVaultId === teamId).length
  )
}

const canSync = (tv: TeamVaultPublic): boolean => (passphrase.value[tv.id] ?? '').length > 0
const showWebdav = computed(() => form.value.backend === 'webdav')
</script>

<template>
  <div class="pa-4">
    <div class="d-flex justify-end mb-3">
      <v-btn color="primary" variant="flat" prepend-icon="mdi-account-group" @click="add">
        {{ t('teams.add') }}
      </v-btn>
    </div>
    <p class="text-body-2 text-medium-emphasis mb-6">{{ t('teams.description') }}</p>

    <v-card v-if="teams.teams.length === 0" variant="tonal" class="pa-8 text-center text-medium-emphasis">
      {{ t('teams.empty') }}
    </v-card>

    <v-card v-for="tv in teams.teams" :key="tv.id" class="pa-4 mb-4">
      <div class="d-flex align-center mb-1">
        <v-icon icon="mdi-account-group-outline" class="mr-2" />
        <span class="text-subtitle-1">{{ tv.name }}</span>
        <v-chip size="x-small" label class="ml-2">{{ tv.backend }}</v-chip>
        <v-spacer />
        <v-btn icon="mdi-pencil" size="small" variant="text" :title="t('common.edit')" @click="edit(tv)" />
        <v-btn
          icon="mdi-delete-outline"
          size="small"
          variant="text"
          :title="t('common.delete')"
          @click="remove(tv)"
        />
      </div>
      <div class="text-caption text-medium-emphasis mb-3">
        {{ t('teams.members', { count: memberCount(tv.id) }) }}
      </div>
      <v-text-field
        v-model="passphrase[tv.id]"
        :label="t('teams.passphrase')"
        type="password"
        prepend-inner-icon="mdi-key"
        autocomplete="off"
        hide-details
        class="mb-3"
      />
      <div class="d-flex ga-2">
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          prepend-icon="mdi-cloud-upload"
          :disabled="!canSync(tv)"
          :loading="busy === tv.id"
          @click="push(tv)"
        >
          {{ t('teams.push') }}
        </v-btn>
        <v-btn
          variant="tonal"
          size="small"
          prepend-icon="mdi-cloud-download"
          :disabled="!canSync(tv)"
          :loading="busy === tv.id"
          @click="pull(tv)"
        >
          {{ t('teams.pull') }}
        </v-btn>
      </div>
    </v-card>

    <v-alert v-if="message" :type="message.type" class="mt-2">
      {{ message.text }}
    </v-alert>

    <div class="text-caption text-medium-emphasis mt-6">
      <v-icon icon="mdi-shield-lock-outline" size="small" class="mr-1" />
      {{ t('teams.zeroKnowledge') }}
    </div>

    <!-- Ekip vault düzenleme -->
    <CrudDialog
      v-model="dialog"
      :title="editing ? t('teams.edit') : t('teams.add')"
      @save="save"
    >
      <v-text-field
        v-model="form.name"
        :label="t('teams.name')"
        :rules="[required]"
        autofocus
      />
          <v-select
            v-model="form.backend"
            :items="backendItems"
            :label="t('teams.backend')"
          />
          <template v-if="!showWebdav">
            <v-text-field
              v-model="form.gistToken"
              :label="t('teams.gistToken')"
              :placeholder="editing?.hasGistToken ? '••••••••' : ''"
              type="password"
              autocomplete="off"
            />
            <v-text-field
              v-model="form.gistId"
              :label="t('teams.gistId')"
            />
          </template>
          <template v-else>
            <v-text-field
              v-model="form.webdavUrl"
              :label="t('teams.webdavUrl')"
              placeholder="https://dav.example.com/team/"
            />
            <v-text-field
              v-model="form.webdavUsername"
              :label="t('teams.webdavUsername')"
              autocomplete="off"
            />
            <v-text-field
              v-model="form.webdavPassword"
              :label="t('teams.webdavPassword')"
              :placeholder="editing?.hasWebdavPassword ? '••••••••' : ''"
              type="password"
              autocomplete="off"
            />
          </template>
    </CrudDialog>
  </div>
</template>
