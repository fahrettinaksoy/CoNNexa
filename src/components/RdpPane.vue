<script setup lang="ts">
import type { SessionDescriptor } from '@shared/types'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ session: SessionDescriptor }>()

const { t } = useI18n()
const canvas = ref<HTMLCanvasElement | null>(null)
const status = ref<'connecting' | 'connected' | 'error'>('connecting')
const errorMsg = ref('')

let session: any = null

onMounted(async () => {
  const cfg = props.session.rdp
  if (!cfg || !canvas.value) {
    status.value = 'error'
    errorMsg.value = t('sessions.missingConfig')
    return
  }
  try {
    // ironrdp-wasm (MIT) — istemci taraflı RDP; proxy RDCleanPath köprüsüdür
    const mod = await import('ironrdp-wasm')
    await mod.default()
    const { SessionBuilder, DesktopSize } = mod

    const builder = new SessionBuilder()
    builder.username(cfg.username)
    builder.password(cfg.password)
    builder.destination(cfg.destination)
    builder.proxyAddress(cfg.proxyUrl)
    builder.desktopSize(new DesktopSize(1280, 800))
    builder.renderCanvas(canvas.value)

    session = await builder.connect()
    status.value = 'connected'
    const termination = await session.run()
    // run() oturum sonlanınca döner
    status.value = 'error'
    errorMsg.value = termination?.reason?.() ?? t('sessions.disconnected')
  } catch (err) {
    status.value = 'error'
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
})

onBeforeUnmount(() => {
  try {
    session?.shutdown()
  } catch {
    // yoksay
  }
  session = null
})
</script>

<template>
  <div class="fill-height position-relative d-flex align-center justify-center rdp-host">
    <canvas ref="canvas" class="rdp-canvas" />
    <div
      v-if="status !== 'connected'"
      class="d-flex flex-column align-center justify-center overlay"
    >
      <template v-if="status === 'connecting'">
        <v-progress-circular indeterminate color="primary" />
        <div class="mt-3 text-body-2">{{ t('sessions.connecting') }}</div>
      </template>
      <template v-else>
        <v-icon icon="mdi-alert-circle-outline" color="error" size="48" />
        <div class="mt-3 text-body-2 text-error px-6 text-center">{{ errorMsg }}</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.rdp-host {
  background: rgb(var(--v-theme-surface));
  overflow: auto;
}
.rdp-canvas {
  max-width: 100%;
  max-height: 100%;
}
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(var(--v-theme-surface), 0.85);
}
</style>
