<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { useResizeObserver, useDebounceFn } from '@vueuse/core'
import { useSessionsStore } from '@/stores/sessions'
import { useRecordingsStore } from '@/stores/recordings'
import { useSettingsStore } from '@/stores/settings'
import { getTerminalTheme } from '@/composables/terminalThemes'

const props = defineProps<{ sessionId: string }>()

const container = ref<HTMLDivElement | null>(null)
const sessions = useSessionsStore()
const recordings = useRecordingsStore()
const settings = useSettingsStore()

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null

const fitAndReport = useDebounceFn(() => {
  if (!terminal || !fitAddon) return
  fitAddon.fit()
  window.connexa.sessions.resize(props.sessionId, terminal.cols, terminal.rows)
  recordings.reportSize(props.sessionId, terminal.cols, terminal.rows)
}, 50)

onMounted(() => {
  terminal = new Terminal({
    fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace',
    fontSize: 13,
    cursorBlink: true,
    allowProposedApi: true,
    theme: getTerminalTheme(settings.terminalTheme)
  })
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(container.value!)
  try {
    terminal.loadAddon(new WebglAddon())
  } catch {
    // WebGL desteklenmiyorsa canvas renderer ile devam et
  }
  fitAddon.fit()
  window.connexa.sessions.resize(props.sessionId, terminal.cols, terminal.rows)
  recordings.reportSize(props.sessionId, terminal.cols, terminal.rows)

  terminal.onData((data) => sessions.writeInput(props.sessionId, data))
  sessions.registerHandler(props.sessionId, (data) => terminal?.write(data))
  terminal.focus()
})

useResizeObserver(container, () => fitAndReport())

// Tema değişince açık terminale canlı uygula
watch(
  () => settings.terminalTheme,
  (id) => {
    if (terminal) terminal.options.theme = getTerminalTheme(id)
  }
)

onBeforeUnmount(() => {
  sessions.unregisterHandler(props.sessionId)
  terminal?.dispose()
  terminal = null
})
</script>

<template>
  <div ref="container" class="terminal-host" />
</template>
