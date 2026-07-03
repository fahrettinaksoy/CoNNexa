<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import { useVaultStore } from '@/stores/vault'
import { useSessionsStore } from '@/stores/sessions'
import { usePluginsStore } from '@/stores/plugins'

interface Command {
  id: string
  label: string
  hint: string
  icon: string
  keywords: string
  run: () => void
}

const { t } = useI18n()
const router = useRouter()
const vault = useVaultStore()
const sessions = useSessionsStore()
const plugins = usePluginsStore()

const open = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const protocolIcon: Record<string, string> = {
  ssh: 'mdi-console-network',
  telnet: 'mdi-lan-connect',
  local: 'mdi-console',
  rdp: 'mdi-monitor',
  vnc: 'mdi-monitor-eye',
  serial: 'mdi-serial-port'
}

/** Tüm komutlar: hostlar (bağlan) + snippet'ler (çalıştır) + statik eylemler */
const allCommands = computed<Command[]>(() => {
  const hostCommands: Command[] = vault.hosts.map((h) => ({
    id: `host:${h.id}`,
    label: h.name,
    hint: `${h.protocol.toUpperCase()} · ${h.hostname}:${h.port}`,
    icon: protocolIcon[h.protocol] ?? 'mdi-server',
    keywords: `${h.name} ${h.hostname} ${h.tags.join(' ')} ${h.protocol}`,
    run: () => void sessions.openForHost(h.id)
  }))

  // Vault snippet'leri + plugin katkısı snippet'ler
  const snippetCommands: Command[] = [...vault.snippets, ...plugins.snippets].map((s) => ({
    id: `snippet:${s.id}`,
    label: s.name,
    hint: t('palette.runSnippet'),
    icon: 'mdi-text-box-outline',
    keywords: `${s.name} ${s.command} ${s.tags.join(' ')}`,
    run: () => void sessions.runCommand(s.command)
  }))

  const actions: Command[] = [
    {
      id: 'action:new-local',
      label: t('sessions.localTerminal'),
      hint: t('palette.action'),
      icon: 'mdi-console',
      keywords: 'local terminal yerel',
      run: () => void sessions.openLocal()
    },
    {
      id: 'action:toggle-broadcast',
      label: t('broadcast.toggle'),
      hint: t('palette.action'),
      icon: 'mdi-bullhorn-outline',
      keywords: 'broadcast yayın',
      run: () => (sessions.broadcast = !sessions.broadcast)
    },
    {
      id: 'action:settings',
      label: t('nav.settings'),
      hint: t('palette.action'),
      icon: 'mdi-cog-outline',
      keywords: 'settings ayarlar',
      run: () => void router.push({ name: 'settings' })
    }
  ]

  return [...hostCommands, ...snippetCommands, ...actions]
})

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return allCommands.value.slice(0, 50)
  // Basit alt dizi (subsequence) eşleşmeli sıralama
  const terms = q.split(/\s+/)
  return allCommands.value
    .filter((c) => {
      const hay = `${c.label} ${c.keywords}`.toLowerCase()
      return terms.every((term) => hay.includes(term))
    })
    .slice(0, 50)
})

watch(results, () => (selectedIndex.value = 0))

function show(): void {
  open.value = true
  query.value = ''
  selectedIndex.value = 0
  nextTick(() => inputRef.value?.focus())
}

function hide(): void {
  open.value = false
}

function execute(cmd?: Command): void {
  const target = cmd ?? results.value[selectedIndex.value]
  if (!target) return
  hide()
  target.run()
}

function onKeydown(e: KeyboardEvent): void {
  // Aç: Cmd/Ctrl+K veya Alt+M (1Remote deseni)
  const toggleKey =
    ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') ||
    (e.altKey && e.key.toLowerCase() === 'm')
  if (toggleKey) {
    e.preventDefault()
    open.value ? hide() : show()
    return
  }
  if (!open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    hide()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    execute()
  }
}

useEventListener(window, 'keydown', onKeydown)

defineExpose({ show })
</script>

<template>
  <v-dialog
    :model-value="open"
    max-width="600"
    location="top"
    scrollable
    @update:model-value="hide"
  >
    <v-card class="palette-card">
      <v-text-field
        ref="inputRef"
        v-model="query"
        :placeholder="t('palette.placeholder')"
        prepend-inner-icon="mdi-magnify"
        variant="solo"
        flat
        hide-details
        autofocus
        density="comfortable"
      />
      <v-divider />
      <v-list density="compact" class="palette-list">
        <v-list-item
          v-for="(cmd, index) in results"
          :key="cmd.id"
          :active="index === selectedIndex"
          :title="cmd.label"
          :subtitle="cmd.hint"
          @click="execute(cmd)"
          @mousemove="selectedIndex = index"
        >
          <template #prepend>
            <v-icon :icon="cmd.icon" size="small" />
          </template>
        </v-list-item>
        <div v-if="results.length === 0" class="text-caption text-medium-emphasis pa-4 text-center">
          {{ t('palette.noResults') }}
        </div>
      </v-list>
      <v-divider />
      <div class="text-caption text-medium-emphasis pa-2 d-flex ga-4 justify-center">
        <span>↑↓ {{ t('palette.navigate') }}</span>
        <span>↵ {{ t('palette.select') }}</span>
        <span>esc {{ t('palette.close') }}</span>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.palette-list {
  max-height: 50vh;
  overflow-y: auto;
}
</style>
