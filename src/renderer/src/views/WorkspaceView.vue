<script setup lang="ts">
import { ref, computed, onMounted, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { useSessionsStore } from '@/stores/sessions'
import { useRecordingsStore } from '@/stores/recordings'
import { hostActionsKey } from '@/composables/hostActions'
import SessionPane from '@/components/SessionPane.vue'
import SftpPanel from '@/components/SftpPanel.vue'
import MonitorPanel from '@/components/MonitorPanel.vue'
import HostDialog from '@/components/HostDialog.vue'
import IdentityDialog from '@/components/IdentityDialog.vue'
import GroupDialog from '@/components/GroupDialog.vue'
import SnippetDialog from '@/components/SnippetDialog.vue'
import AiAssistantDialog from '@/components/AiAssistantDialog.vue'
import HostTreeNode from '@/components/HostTreeNode.vue'
import HostListItem from '@/components/HostListItem.vue'
import type { Host, Group, Snippet, IdentityPublic } from '@shared/types'

const { t } = useI18n()
const vault = useVaultStore()
const sessions = useSessionsStore()
const recordings = useRecordingsStore()

const search = ref('')
const hostDialog = ref(false)
const editingHost = ref<Host | null>(null)
const identityDialog = ref(false)
const editingIdentity = ref<IdentityPublic | null>(null)
const groupDialog = ref(false)
const editingGroup = ref<Group | null>(null)
const newGroupParentId = ref<string | undefined>(undefined)
const snippetDialog = ref(false)
const editingSnippet = ref<Snippet | null>(null)
const connectError = ref<string | null>(null)
const notice = ref<string | null>(null)
const panel = ref(['hosts'])
const showSftp = ref(true)
const showMonitor = ref(false)
const aiDialog = ref(false)

const activeSession = computed(() =>
  sessions.open.find((s) => s.id === sessions.activeId)
)

/** Aktif pane terminal türündeyse bölünebilir */
const canSplitActive = computed(() => {
  const p = activeSession.value?.protocol
  return p === 'ssh' || p === 'telnet' || p === 'local'
})

/** SFTP toggle yalnızca tek pane'li aktif SSH grubunda anlamlı */
const sftpEligible = computed(() => {
  const group = sessions.activeGroup
  return (
    !!group &&
    group.paneIds.length === 1 &&
    sessions.sessionById(group.activePaneId)?.protocol === 'ssh'
  )
})

onMounted(() => {
  if (!vault.loaded) vault.load()
  recordings.init()
})

async function toggleRecording(): Promise<void> {
  const s = activeSession.value
  if (!s) return
  const error = await recordings.toggle(s.id, s.title)
  if (error) connectError.value = error
}

const filteredHosts = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return vault.hosts
  return vault.hosts.filter(
    (h) =>
      h.name.toLowerCase().includes(q) ||
      h.hostname.toLowerCase().includes(q) ||
      h.tags.some((tag) => tag.toLowerCase().includes(q))
  )
})

const protocolIcon: Record<string, string> = {
  ssh: 'mdi-console-network',
  telnet: 'mdi-lan-connect',
  local: 'mdi-console',
  rdp: 'mdi-monitor',
  vnc: 'mdi-monitor-eye',
  serial: 'mdi-serial-port'
}

async function connect(host: Host): Promise<void> {
  connectError.value = null
  const error = await sessions.openForHost(host.id)
  if (error) connectError.value = `${t('sessions.connectionFailed')}: ${error}`
}

async function openLocal(): Promise<void> {
  connectError.value = null
  const error = await sessions.openLocal()
  if (error) connectError.value = `${t('sessions.connectionFailed')}: ${error}`
}

function addHost(): void {
  editingHost.value = null
  hostDialog.value = true
}

function editHost(host: Host): void {
  editingHost.value = host
  hostDialog.value = true
}

function addIdentity(): void {
  editingIdentity.value = null
  identityDialog.value = true
}

function editIdentity(identity: IdentityPublic): void {
  editingIdentity.value = identity
  identityDialog.value = true
}

function addGroup(parentId?: string): void {
  editingGroup.value = null
  newGroupParentId.value = parentId
  groupDialog.value = true
}

function editGroup(group: Group): void {
  editingGroup.value = group
  groupDialog.value = true
}

function addSnippet(): void {
  editingSnippet.value = null
  snippetDialog.value = true
}

function editSnippet(snippet: Snippet): void {
  editingSnippet.value = snippet
  snippetDialog.value = true
}

function runSnippet(snippet: Snippet): void {
  const count = sessions.runCommand(snippet.command)
  if (count === 0) notice.value = t('snippets.noTarget')
  else if (sessions.broadcast) notice.value = t('snippets.ranBroadcast', { count })
}

async function launchExternalRdp(host: Host): Promise<void> {
  connectError.value = null
  const result = await window.connexa.rdp.launchExternal(host.id)
  if (!result.ok) connectError.value = `${t('sessions.connectionFailed')}: ${result.error}`
  else notice.value = t('hosts.externalRdpLaunched')
}

provide(hostActionsKey, { connect, editHost, editGroup, addGroup, launchExternalRdp })
</script>

<template>
  <div class="d-flex fill-height">
    <!-- Sol panel: sunucular ve kimlikler -->
    <div class="side-panel d-flex flex-column">
      <v-text-field
        v-model="search"
        :placeholder="t('hosts.search')"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        hide-details
        variant="solo-filled"
        flat
        class="ma-2 flex-grow-0"
      />
      <v-expansion-panels v-model="panel" multiple variant="accordion" class="flex-grow-1 overflow-y-auto">
        <v-expansion-panel value="hosts">
          <v-expansion-panel-title>
            <v-icon icon="mdi-server-network" size="small" class="mr-2" />
            {{ t('hosts.title') }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div class="d-flex ga-1 mb-2">
              <v-btn
                size="small"
                variant="tonal"
                color="primary"
                prepend-icon="mdi-plus"
                class="flex-grow-1"
                @click="addHost"
              >
                {{ t('hosts.add') }}
              </v-btn>
              <v-btn
                size="small"
                variant="tonal"
                icon="mdi-folder-plus-outline"
                :title="t('groups.add')"
                @click="addGroup()"
              />
            </div>
            <div
              v-if="vault.hosts.length === 0 && vault.groups.length === 0"
              class="text-caption text-medium-emphasis pa-2"
            >
              {{ t('hosts.empty') }}
            </div>
            <!-- Arama: düz liste; normalde: grup ağacı -->
            <v-list v-if="search.trim()" density="compact" nav>
              <HostListItem v-for="host in filteredHosts" :key="host.id" :host="host" />
            </v-list>
            <v-list v-else density="compact" nav>
              <HostTreeNode />
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel value="identities">
          <v-expansion-panel-title>
            <v-icon icon="mdi-key-chain" size="small" class="mr-2" />
            {{ t('identities.title') }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-btn
              block
              size="small"
              variant="tonal"
              prepend-icon="mdi-plus"
              class="mb-2"
              @click="addIdentity"
            >
              {{ t('identities.add') }}
            </v-btn>
            <div v-if="vault.identities.length === 0" class="text-caption text-medium-emphasis pa-2">
              {{ t('identities.empty') }}
            </div>
            <v-list density="compact" nav>
              <v-list-item
                v-for="identity in vault.identities"
                :key="identity.id"
                :title="identity.name"
                :subtitle="identity.username"
                prepend-icon="mdi-account-key"
                @click="editIdentity(identity)"
              >
                <template #append>
                  <v-btn
                    icon="mdi-delete-outline"
                    size="x-small"
                    variant="text"
                    @click.stop="vault.deleteIdentity(identity.id)"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>

        <v-expansion-panel value="snippets">
          <v-expansion-panel-title>
            <v-icon icon="mdi-text-box-multiple-outline" size="small" class="mr-2" />
            {{ t('snippets.title') }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-btn
              block
              size="small"
              variant="tonal"
              prepend-icon="mdi-plus"
              class="mb-2"
              @click="addSnippet"
            >
              {{ t('snippets.add') }}
            </v-btn>
            <div v-if="vault.snippets.length === 0" class="text-caption text-medium-emphasis pa-2">
              {{ t('snippets.empty') }}
            </div>
            <v-list density="compact" nav>
              <v-list-item
                v-for="snippet in vault.snippets"
                :key="snippet.id"
                :title="snippet.name"
                :subtitle="snippet.command"
                prepend-icon="mdi-text-box-outline"
                @dblclick="runSnippet(snippet)"
              >
                <template #append>
                  <v-btn
                    icon="mdi-play"
                    size="x-small"
                    variant="text"
                    :title="t('snippets.run')"
                    @click.stop="runSnippet(snippet)"
                  />
                  <v-menu>
                    <template #activator="{ props: menuProps }">
                      <v-btn
                        icon="mdi-dots-vertical"
                        size="x-small"
                        variant="text"
                        v-bind="menuProps"
                      />
                    </template>
                    <v-list density="compact">
                      <v-list-item :title="t('snippets.edit')" @click="editSnippet(snippet)" />
                      <v-list-item
                        :title="t('common.delete')"
                        base-color="error"
                        @click="vault.deleteSnippet(snippet.id)"
                      />
                    </v-list>
                  </v-menu>
                </template>
              </v-list-item>
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>

    <v-divider vertical />

    <!-- Sağ alan: oturum sekmeleri + terminal -->
    <div class="d-flex flex-column flex-grow-1" style="min-width: 0">
      <div class="d-flex align-center">
        <v-tabs
          :model-value="sessions.activeGroupId"
          density="compact"
          show-arrows
          class="flex-grow-1"
          color="primary"
          @update:model-value="sessions.selectGroup($event as string)"
        >
          <v-tab v-for="group in sessions.groups" :key="group.id" :value="group.id">
            <v-icon
              :icon="protocolIcon[sessions.sessionById(group.activePaneId)?.protocol ?? 'local']"
              size="small"
              class="mr-1"
            />
            {{ sessions.groupTitle(group) }}
            <v-btn
              icon="mdi-close"
              size="x-small"
              variant="text"
              class="ml-1"
              @click.stop="sessions.closeGroup(group.id)"
            />
          </v-tab>
        </v-tabs>
        <v-btn
          v-if="canSplitActive"
          :icon="
            activeSession && recordings.isRecording(activeSession.id)
              ? 'mdi-record-circle'
              : 'mdi-record-circle-outline'
          "
          size="small"
          variant="text"
          :color="activeSession && recordings.isRecording(activeSession.id) ? 'error' : undefined"
          :title="t('recording.toggle')"
          @click="toggleRecording"
        />
        <v-btn
          v-if="canSplitActive"
          icon="mdi-arrow-split-vertical"
          size="small"
          variant="text"
          :title="t('sessions.splitVertical')"
          @click="sessions.splitActive('row')"
        />
        <v-btn
          v-if="canSplitActive"
          icon="mdi-arrow-split-horizontal"
          size="small"
          variant="text"
          :title="t('sessions.splitHorizontal')"
          @click="sessions.splitActive('col')"
        />
        <v-btn
          v-if="sessions.liveTerminalIds.length > 1 || sessions.broadcast"
          :icon="sessions.broadcast ? 'mdi-bullhorn' : 'mdi-bullhorn-outline'"
          size="small"
          variant="text"
          :color="sessions.broadcast ? 'primary' : undefined"
          :title="t('broadcast.toggle')"
          @click="sessions.broadcast = !sessions.broadcast"
        />
        <v-btn
          v-if="sftpEligible"
          :icon="showSftp ? 'mdi-file-tree' : 'mdi-file-tree-outline'"
          size="small"
          variant="text"
          :color="showSftp ? 'primary' : undefined"
          :title="t('sftp.toggle')"
          @click="showSftp = !showSftp"
        />
        <v-btn
          v-if="sftpEligible"
          :icon="showMonitor ? 'mdi-gauge' : 'mdi-gauge-low'"
          size="small"
          variant="text"
          :color="showMonitor ? 'primary' : undefined"
          :title="t('monitor.toggle')"
          @click="showMonitor = !showMonitor"
        />
        <v-btn
          icon="mdi-robot-outline"
          size="small"
          variant="text"
          :title="t('ai.title')"
          @click="aiDialog = true"
        />
        <v-btn
          icon="mdi-plus"
          size="small"
          variant="text"
          :title="t('sessions.newLocal')"
          class="mx-1"
          @click="openLocal"
        />
      </div>
      <v-divider />

      <v-banner
        v-if="sessions.broadcast"
        density="compact"
        bg-color="primary"
        icon="mdi-bullhorn"
        class="broadcast-banner"
      >
        {{ t('broadcast.active', { count: sessions.liveTerminalIds.length }) }}
      </v-banner>

      <div class="flex-grow-1 position-relative" style="min-height: 0">
        <template v-if="sessions.groups.length > 0">
          <div
            v-for="group in sessions.groups"
            :key="group.id"
            v-show="sessions.activeGroupId === group.id"
            class="fill-height d-flex"
          >
            <!-- Pane grubu: tek pane ya da split (row/col) -->
            <div
              class="flex-grow-1 d-flex"
              :class="group.direction === 'col' ? 'flex-column' : 'flex-row'"
              style="min-width: 0"
            >
              <template v-for="(paneId, idx) in group.paneIds" :key="paneId">
                <v-divider v-if="idx > 0" :vertical="group.direction === 'row'" />
                <SessionPane
                  v-if="sessions.sessionById(paneId)"
                  :session="sessions.sessionById(paneId)!"
                  :group-id="group.id"
                  :active="group.activePaneId === paneId"
                  :multi="group.paneIds.length > 1"
                />
              </template>
            </div>
            <!-- SFTP / izleme: yalnızca tek pane'li ve aktif SSH grubunda -->
            <template
              v-if="
                group.id === sessions.activeGroupId &&
                group.paneIds.length === 1 &&
                sessions.sessionById(group.activePaneId)?.protocol === 'ssh'
              "
            >
              <template v-if="showSftp">
                <v-divider vertical />
                <SftpPanel :session-id="group.activePaneId" />
              </template>
              <template v-if="showMonitor">
                <v-divider vertical />
                <MonitorPanel :session-id="group.activePaneId" />
              </template>
            </template>
          </div>
        </template>
        <div v-else class="d-flex flex-column align-center justify-center fill-height text-center">
          <v-icon icon="mdi-lan-pending" size="64" class="mb-4 text-medium-emphasis" />
          <div class="text-h6">{{ t('sessions.welcomeTitle') }}</div>
          <div class="text-body-2 text-medium-emphasis mt-1" style="max-width: 360px">
            {{ t('sessions.welcomeText') }}
          </div>
          <v-btn color="primary" variant="tonal" prepend-icon="mdi-console" class="mt-4" @click="openLocal">
            {{ t('sessions.localTerminal') }}
          </v-btn>
        </div>
      </div>
    </div>

    <HostDialog v-model="hostDialog" :host="editingHost" />
    <IdentityDialog v-model="identityDialog" :identity="editingIdentity" />
    <GroupDialog v-model="groupDialog" :group="editingGroup" :parent-id="newGroupParentId" />
    <SnippetDialog v-model="snippetDialog" :snippet="editingSnippet" />
    <AiAssistantDialog v-model="aiDialog" />

    <v-snackbar
      :model-value="connectError !== null"
      color="error"
      timeout="6000"
      @update:model-value="connectError = null"
    >
      {{ connectError }}
    </v-snackbar>
    <v-snackbar
      :model-value="notice !== null"
      timeout="3000"
      @update:model-value="notice = null"
    >
      {{ notice }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.side-panel {
  width: 300px;
  min-width: 300px;
}
.broadcast-banner {
  flex: 0 0 auto;
}
</style>
