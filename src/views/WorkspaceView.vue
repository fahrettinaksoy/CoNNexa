<script setup lang="ts">
import type { Group, Host, IdentityPublic, Snippet } from '@shared/types'
import { computed, onActivated, onDeactivated, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AiAssistantDialog from '@/components/AiAssistantDialog.vue'
import GroupDialog from '@/components/GroupDialog.vue'
import HostDialog from '@/components/HostDialog.vue'
import HostListItem from '@/components/HostListItem.vue'
import HostTreeNode from '@/components/HostTreeNode.vue'
import IdentityDialog from '@/components/IdentityDialog.vue'
import LtrRegion from '@/components/LtrRegion.vue'
import MonitorPanel from '@/components/MonitorPanel.vue'
import SessionPane from '@/components/SessionPane.vue'
import SftpPanel from '@/components/SftpPanel.vue'
import SnippetDialog from '@/components/SnippetDialog.vue'
import { hostActionsKey } from '@/composables/hostActions'
import { keysFor } from '@/composables/keymap'
import { useAppHotkeys } from '@/composables/useAppHotkeys'
import { useResponsive } from '@/composables/useResponsive'
import { useWorkbenchTheme } from '@/composables/useWorkbenchTheme'
import { protocolIcon } from '@/plugins/icons'
import { useRecordingsStore } from '@/stores/recordings'
import { useSessionsStore } from '@/stores/sessions'
import { useVaultStore } from '@/stores/vault'

const { t } = useI18n()
const vault = useVaultStore()
const sessions = useSessionsStore()
const recordings = useRecordingsStore()
const { compact, sidePanelWidth, auxiliaryDocked, auxiliaryWidth } = useResponsive()
// Terminal chrome'u genel temadan bağımsız olarak terminalin açık/koyuluğunu izler.
const { workbenchTheme } = useWorkbenchTheme()

// Sol panel dar pencerede (compact) overlay drawer'a döner; geniş pencerede
// kalıcı sütundur. Compact'a geçildiğinde otomatik kapanır, geri dönüldüğünde
// tekrar görünür.
const sidePanelOpen = ref(true)
watch(compact, (isCompact) => (sidePanelOpen.value = !isCompact), { immediate: true })

// Sunucu/Kimlik/Komut sekmelerinin her biri kendi bağımsız arama kutusuna
// sahiptir; bir sekmede yazılan sorgu diğerini filtrelemez.
const hostSearch = ref('')
const identitySearch = ref('')
const snippetSearch = ref('')

/**
 * Sunucu/Kimlik/Grup/Snippet ekle-düzenle panellerinin hepsi [[side-sheet]]
 * (bkz. SideSheet.vue) kullanır. Bunlardan aynı anda yalnızca biri açık
 * olsun diye dört bağımsız boolean yerine tek bir seçici ref + computed
 * v-model'ler kullanılır — iki formun aynı anda görünmesi kullanıcı için
 * kafa karıştırıcı olurdu (SideSheet artık `v-dialog` tabanlı olduğundan
 * bu yalnızca bir UX tercihidir, görsel bozulmayı önlemek için gerekli
 * değildir).
 */
type CrudDialogKind = 'host' | 'identity' | 'group' | 'snippet'
const activeCrudDialog = ref<CrudDialogKind | null>(null)
const hostDialog = computed({
  get: () => activeCrudDialog.value === 'host',
  set: (v) => (activeCrudDialog.value = v ? 'host' : null)
})
const identityDialog = computed({
  get: () => activeCrudDialog.value === 'identity',
  set: (v) => (activeCrudDialog.value = v ? 'identity' : null)
})
const groupDialog = computed({
  get: () => activeCrudDialog.value === 'group',
  set: (v) => (activeCrudDialog.value = v ? 'group' : null)
})
const snippetDialog = computed({
  get: () => activeCrudDialog.value === 'snippet',
  set: (v) => (activeCrudDialog.value = v ? 'snippet' : null)
})

const editingHost = ref<Host | null>(null)
const editingIdentity = ref<IdentityPublic | null>(null)
const editingGroup = ref<Group | null>(null)
const newGroupParentId = ref<string | undefined>(undefined)
const editingSnippet = ref<Snippet | null>(null)
const connectError = ref<string | null>(null)
const notice = ref<string | null>(null)
// Sol panel bölümleri artık dikey sekme (master-detail): tek seçim.
const section = ref<'hosts' | 'identities' | 'snippets'>('hosts')
const showSftp = ref(true)
const showMonitor = ref(false)
const aiDialog = ref(false)

const activeSession = computed(() => sessions.open.find((s) => s.id === sessions.activeId))

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

/** Yardımcı panellerin (SFTP / Monitor) bağlanacağı aktif oturum. */
const auxSessionId = computed(() =>
  sftpEligible.value ? (sessions.activeGroup?.activePaneId ?? null) : null
)

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
  const q = hostSearch.value.trim().toLowerCase()
  if (!q) return vault.hosts
  return vault.hosts.filter(
    (h) =>
      h.name.toLowerCase().includes(q) ||
      h.hostname.toLowerCase().includes(q) ||
      h.tags.some((tag) => tag.toLowerCase().includes(q))
  )
})

const filteredIdentities = computed(() => {
  const q = identitySearch.value.trim().toLowerCase()
  if (!q) return vault.identities
  return vault.identities.filter(
    (i) => i.name.toLowerCase().includes(q) || i.username.toLowerCase().includes(q)
  )
})

const filteredSnippets = computed(() => {
  const q = snippetSearch.value.trim().toLowerCase()
  if (!q) return vault.snippets
  return vault.snippets.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.command.toLowerCase().includes(q) ||
      s.tags.some((tag) => tag.toLowerCase().includes(q))
  )
})

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

// ── Klavye kısayolları (yalnızca çalışma alanı görünürken) ──────────────────
// WorkspaceView keep-alive ile ayakta kaldığından, başka bir ekrandayken oturum
// kısayolları tetiklenmesin diye aktiflik durumuna göre kayıtları açıp kapatıyoruz.
const workspaceActive = ref(true)
onActivated(() => (workspaceActive.value = true))
onDeactivated(() => (workspaceActive.value = false))

function closeActiveGroup(): void {
  if (sessions.activeGroupId) sessions.closeGroup(sessions.activeGroupId)
}

function cycleTab(direction: 1 | -1): void {
  const list = sessions.groups
  if (list.length < 2) return
  const index = list.findIndex((g) => g.id === sessions.activeGroupId)
  const next = list[(index + direction + list.length) % list.length]
  sessions.selectGroup(next.id)
}

useAppHotkeys(
  {
    newTerminal: () => void openLocal(),
    closeSession: closeActiveGroup,
    splitVertical: () => canSplitActive.value && void sessions.splitActive('row'),
    splitHorizontal: () => canSplitActive.value && void sessions.splitActive('col'),
    nextTab: () => cycleTab(1),
    prevTab: () => cycleTab(-1),
    toggleSftp: () => sftpEligible.value && (showSftp.value = !showSftp.value),
    toggleMonitor: () => sftpEligible.value && (showMonitor.value = !showMonitor.value),
    toggleBroadcast: () => (sessions.broadcast = !sessions.broadcast),
    toggleRecording: () => void toggleRecording(),
    aiAssistant: () => (aiDialog.value = true)
  },
  { scope: 'workspace', enabled: workspaceActive }
)
</script>

<template>
  <v-layout class="fill-height">
    <!-- Sol panel: sunucular ve kimlikler.
         Geniş pencerede kalıcı sütun, dar (compact) pencerede overlay drawer. -->
    <v-navigation-drawer
      v-model="sidePanelOpen"
      :permanent="!compact"
      :temporary="compact"
      :width="sidePanelWidth"
      class="side-panel"
    >
      <div class="d-flex flex-column fill-height">
        <!-- Master-detail: soldaki dikey sekme rayı bölümü seçer, seçilen bölüm
             içeriği sağ tarafta açılır (MD3 vertical tabs). Her sekmenin kendi
             arama kutusu vardır (bkz. aşağıdaki tabs-window-item'lar). -->
        <div class="d-flex flex-grow-1" style="min-height: 0">
          <v-tabs
            v-model="section"
            direction="vertical"
            color="primary"
            class="side-rail flex-grow-0"
          >
            <v-tab value="hosts" :aria-label="t('hosts.title')" class="side-rail__tab">
              <span class="side-rail__indicator">
                <v-icon icon="mdi-server-network" size="20" />
              </span>
              <span class="side-rail__label">{{ t('hosts.navLabel') }}</span>
            </v-tab>
            <v-tab value="identities" :aria-label="t('identities.title')" class="side-rail__tab">
              <span class="side-rail__indicator">
                <v-icon icon="mdi-key-chain" size="20" />
              </span>
              <span class="side-rail__label">{{ t('identities.navLabel') }}</span>
            </v-tab>
            <v-tab value="snippets" :aria-label="t('snippets.title')" class="side-rail__tab">
              <span class="side-rail__indicator">
                <v-icon icon="mdi-text-box-multiple-outline" size="20" />
              </span>
              <span class="side-rail__label">{{ t('snippets.navLabel') }}</span>
            </v-tab>
          </v-tabs>

          <v-tabs-window
            v-model="section"
            class="flex-grow-1 overflow-y-auto pa-2"
            style="min-width: 0"
          >
            <!-- Sunucular -->
            <v-tabs-window-item value="hosts">
              <div class="text-overline text-medium-emphasis px-1 mb-1">{{ t('hosts.title') }}</div>
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
              <v-text-field
                v-model="hostSearch"
                :placeholder="t('hosts.search')"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                hide-details
                variant="solo-filled"
                flat
                clearable
                class="mb-2"
              />
              <div
                v-if="vault.hosts.length === 0 && vault.groups.length === 0"
                class="text-caption text-medium-emphasis pa-2"
              >
                {{ t('hosts.empty') }}
              </div>
              <!-- Arama: düz liste; normalde: grup ağacı -->
              <template v-if="hostSearch.trim()">
                <div
                  v-if="filteredHosts.length === 0"
                  class="text-caption text-medium-emphasis pa-2"
                >
                  {{ t('common.noResults') }}
                </div>
                <v-list density="compact" nav>
                  <HostListItem v-for="host in filteredHosts" :key="host.id" :host="host" />
                </v-list>
              </template>
              <v-list v-else density="compact" nav>
                <HostTreeNode />
              </v-list>
            </v-tabs-window-item>

            <!-- Kimlikler -->
            <v-tabs-window-item value="identities">
              <div class="text-overline text-medium-emphasis px-1 mb-1">
                {{ t('identities.title') }}
              </div>
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
              <v-text-field
                v-model="identitySearch"
                :placeholder="t('identities.search')"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                hide-details
                variant="solo-filled"
                flat
                clearable
                class="mb-2"
              />
              <div
                v-if="vault.identities.length === 0"
                class="text-caption text-medium-emphasis pa-2"
              >
                {{ t('identities.empty') }}
              </div>
              <div
                v-else-if="filteredIdentities.length === 0"
                class="text-caption text-medium-emphasis pa-2"
              >
                {{ t('common.noResults') }}
              </div>
              <v-list nav>
                <v-list-item
                  v-for="identity in filteredIdentities"
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
                      :title="t('common.delete')"
                      @click.stop="vault.deleteIdentity(identity.id)"
                    />
                  </template>
                </v-list-item>
              </v-list>
            </v-tabs-window-item>

            <!-- Komut parçacıkları -->
            <v-tabs-window-item value="snippets">
              <div class="text-overline text-medium-emphasis px-1 mb-1">
                {{ t('snippets.title') }}
              </div>
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
              <v-text-field
                v-model="snippetSearch"
                :placeholder="t('snippets.search')"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                hide-details
                variant="solo-filled"
                flat
                clearable
                class="mb-2"
              />
              <div
                v-if="vault.snippets.length === 0"
                class="text-caption text-medium-emphasis pa-2"
              >
                {{ t('snippets.empty') }}
              </div>
              <div
                v-else-if="filteredSnippets.length === 0"
                class="text-caption text-medium-emphasis pa-2"
              >
                {{ t('common.noResults') }}
              </div>
              <v-list nav>
                <v-list-item
                  v-for="snippet in filteredSnippets"
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
                          :title="t('common.more')"
                          v-bind="menuProps"
                        />
                      </template>
                      <v-list>
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
            </v-tabs-window-item>
          </v-tabs-window>
        </div>
      </div>
    </v-navigation-drawer>

    <!-- Yardımcı paneller (SFTP / Monitor): geniş pencerede terminalin yanına
         gömülü (docked) sütun; dar pencerede sağdan açılan overlay drawer. -->
    <v-navigation-drawer
      v-if="auxSessionId && showSftp"
      :model-value="showSftp"
      location="right"
      :permanent="auxiliaryDocked"
      :temporary="!auxiliaryDocked"
      :width="auxiliaryWidth"
      @update:model-value="showSftp = $event"
    >
      <SftpPanel :session-id="auxSessionId" />
    </v-navigation-drawer>
    <v-navigation-drawer
      v-if="auxSessionId && showMonitor"
      :model-value="showMonitor"
      location="right"
      :permanent="auxiliaryDocked"
      :temporary="!auxiliaryDocked"
      :width="auxiliaryWidth"
      @update:model-value="showMonitor = $event"
    >
      <MonitorPanel :session-id="auxSessionId" />
    </v-navigation-drawer>

    <!-- Sağ alan: oturum sekmeleri + terminal -->
    <v-main class="d-flex flex-column" style="min-width: 0">
      <div class="d-flex align-center">
        <v-btn
          v-if="compact"
          icon="mdi-menu"
          size="small"
          variant="text"
          :title="t('nav.toggleSidebar')"
          @click="sidePanelOpen = !sidePanelOpen"
        />
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
              :icon="protocolIcon(sessions.sessionById(group.activePaneId)?.protocol)"
              size="small"
              class="mr-1"
            />
            {{ sessions.groupTitle(group) }}
            <v-btn
              icon="mdi-close"
              size="x-small"
              variant="text"
              class="ml-1"
              :title="t('sessions.close')"
              @click.stop="sessions.closeGroup(group.id)"
            />
          </v-tab>
        </v-tabs>
        <!-- Araç çubuğu eylem butonları: hepsi küçük/text ve ipuçları alt konumda.
             Tekrarı tek bir defaults-provider'da toplarız (bkz. defaults-providers). -->
        <v-defaults-provider
          :defaults="{ VBtn: { size: 'small', variant: 'text' }, VTooltip: { location: 'bottom' } }"
        >
          <v-btn
            v-if="canSplitActive"
            :color="activeSession && recordings.isRecording(activeSession.id) ? 'error' : undefined"
            @click="toggleRecording"
          >
            <v-icon
              :icon="
                activeSession && recordings.isRecording(activeSession.id)
                  ? 'mdi-record-circle'
                  : 'mdi-record-circle-outline'
              "
            />
            <v-tooltip activator="parent">
              <div class="d-flex align-center ga-2">
                {{ t('recording.toggle') }}
                <v-hotkey :keys="keysFor('toggleRecording')" />
              </div>
            </v-tooltip>
          </v-btn>
          <v-btn v-if="canSplitActive" @click="sessions.splitActive('row')">
            <v-icon icon="mdi-arrow-split-vertical" />
            <v-tooltip activator="parent">
              <div class="d-flex align-center ga-2">
                {{ t('sessions.splitVertical') }}
                <v-hotkey :keys="keysFor('splitVertical')" />
              </div>
            </v-tooltip>
          </v-btn>
          <v-btn v-if="canSplitActive" @click="sessions.splitActive('col')">
            <v-icon icon="mdi-arrow-split-horizontal" />
            <v-tooltip activator="parent">
              <div class="d-flex align-center ga-2">
                {{ t('sessions.splitHorizontal') }}
                <v-hotkey :keys="keysFor('splitHorizontal')" />
              </div>
            </v-tooltip>
          </v-btn>
          <v-btn
            v-if="sessions.liveTerminalIds.length > 1 || sessions.broadcast"
            :color="sessions.broadcast ? 'primary' : undefined"
            @click="sessions.broadcast = !sessions.broadcast"
          >
            <v-icon :icon="sessions.broadcast ? 'mdi-bullhorn' : 'mdi-bullhorn-outline'" />
            <v-tooltip activator="parent">
              <div class="d-flex align-center ga-2">
                {{ t('broadcast.toggle') }}
                <v-hotkey :keys="keysFor('toggleBroadcast')" />
              </div>
            </v-tooltip>
          </v-btn>
          <v-btn
            v-if="sftpEligible"
            :color="showSftp ? 'primary' : undefined"
            @click="showSftp = !showSftp"
          >
            <v-icon :icon="showSftp ? 'mdi-file-tree' : 'mdi-file-tree-outline'" />
            <v-tooltip activator="parent">
              <div class="d-flex align-center ga-2">
                {{ t('sftp.toggle') }}
                <v-hotkey :keys="keysFor('toggleSftp')" />
              </div>
            </v-tooltip>
          </v-btn>
          <v-btn
            v-if="sftpEligible"
            :color="showMonitor ? 'primary' : undefined"
            @click="showMonitor = !showMonitor"
          >
            <v-icon :icon="showMonitor ? 'mdi-gauge' : 'mdi-gauge-low'" />
            <v-tooltip activator="parent">
              <div class="d-flex align-center ga-2">
                {{ t('monitor.toggle') }}
                <v-hotkey :keys="keysFor('toggleMonitor')" />
              </div>
            </v-tooltip>
          </v-btn>
          <v-btn @click="aiDialog = true">
            <v-icon icon="mdi-robot-outline" />
            <v-tooltip activator="parent">
              <div class="d-flex align-center ga-2">
                {{ t('ai.title') }}
                <v-hotkey :keys="keysFor('aiAssistant')" />
              </div>
            </v-tooltip>
          </v-btn>
          <v-btn class="mx-1" @click="openLocal">
            <v-icon icon="mdi-plus" />
            <v-tooltip activator="parent">
              <div class="d-flex align-center ga-2">
                {{ t('sessions.newLocal') }}
                <v-hotkey :keys="keysFor('newTerminal')" />
              </div>
            </v-tooltip>
          </v-btn>
        </v-defaults-provider>
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
            v-show="sessions.activeGroupId === group.id"
            :key="group.id"
            class="fill-height d-flex"
          >
            <!-- Pane grubu: tek pane ya da split (row/col).
                 Teknik içerik LTR yalıtılır (LtrRegion) ve terminal chrome'u genel
                 temadan bağımsız olarak terminalin açık/koyuluğunu izler
                 (VThemeProvider) — böylece açık arayüzde bile koyu terminal koyu kalır. -->
            <LtrRegion>
              <v-theme-provider
                :theme="workbenchTheme"
                with-background
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
              </v-theme-provider>
            </LtrRegion>
            <!-- SFTP / izleme panelleri layout seviyesindeki sağ drawer'lardadır;
                 bkz. yukarıdaki <v-navigation-drawer location="right"> blokları. -->
          </div>
        </template>
        <div v-else class="d-flex flex-column align-center justify-center fill-height text-center">
          <v-icon icon="mdi-lan-pending" size="64" class="mb-4 text-medium-emphasis" />
          <div class="text-h6">{{ t('sessions.welcomeTitle') }}</div>
          <div class="text-body-2 text-medium-emphasis mt-1" style="max-width: 360px">
            {{ t('sessions.welcomeText') }}
          </div>
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-console"
            class="mt-4"
            @click="openLocal"
          >
            {{ t('sessions.localTerminal') }}
          </v-btn>
        </div>
      </div>
    </v-main>

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
    <v-snackbar :model-value="notice !== null" timeout="3000" @update:model-value="notice = null">
      {{ notice }}
    </v-snackbar>
  </v-layout>
</template>

<style scoped>
/* Sol panel içeriği drawer'ın tüm yüksekliğini kaplar; genişlik drawer prop'u
   (`sidePanelWidth`) ile responsive olarak yönetilir. */
.side-panel :deep(.v-navigation-drawer__content) {
  display: flex;
  flex-direction: column;
}
.broadcast-banner {
  flex: 0 0 auto;
}
/* Sol panelin bölüm rayı (Sunucular/Kimlikler/Komutlar) — MD3 "Navigation
   Rail" deseni: ikon üstte + etiket altta, ikisi de ortalı, ana gövdeden
   çizgi yerine hafif yüzey farkıyla ayrışır. */
.side-rail {
  width: 76px;
  background: rgb(var(--v-theme-surface-light));
}

.side-rail :deep(.v-tab) {
  width: 100%;
  max-width: 100%;
  height: auto;
  min-height: 64px;
  padding: 10px 4px 8px;
  opacity: 1;
}

/* Slot içeriğinin gerçek flex kabı .v-btn__content'tir — butonun kendisi
   değil. Varsayılan satır (row) yerleşimini sütuna çeviriyoruz ki ikon
   üstte, etiket altta olsun; varsayılan `white-space: nowrap` de etiketin
   genişliği zorlayıp taşmasına yol açtığından burada kapatılır. */
.side-rail :deep(.v-tab .v-btn__content) {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  white-space: normal;
}

/* Vuetify'ın varsayılan aktif/hover katmanı (v-btn__overlay) tüm öğeyi
   kaplar; MD3'te bu katman sadece ikonun etrafındaki "pill" göstergede
   olmalı — bu yüzden varsayılan katmanı burada kapatıp göstergeyi kendi
   elementimizle (.side-rail__indicator) veriyoruz. */
.side-rail :deep(.v-tab .v-btn__overlay) {
  opacity: 0 !important;
}

.side-rail__indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 32px;
  border-radius: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.side-rail__label {
  font-size: 11px;
  line-height: 1.2;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: rgb(var(--v-theme-on-surface-variant));
  transition: color 0.18s ease;
}

.side-rail :deep(.v-tab.v-btn--active) .side-rail__indicator {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

.side-rail :deep(.v-tab.v-btn--active) .side-rail__label {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.side-rail :deep(.v-tab:hover) .side-rail__indicator {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.side-rail :deep(.v-tab.v-btn--active:hover) .side-rail__indicator {
  background: rgba(var(--v-theme-primary), 0.18);
}
</style>
