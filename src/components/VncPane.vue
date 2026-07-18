<script setup lang="ts">
import type { SessionDescriptor } from '@shared/types'
// noVNC çekirdek istemcisi (MPL-2.0) — paket kökü core/rfb.js'e eşlenir
import RFB from '@novnc/novnc'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ session: SessionDescriptor }>()

const { t } = useI18n()
const container = ref<HTMLDivElement | null>(null)
const status = ref<'connecting' | 'connected' | 'error'>('connecting')
const errorMsg = ref('')

let rfb: any = null

onMounted(() => {
  const cfg = props.session.vnc
  if (!cfg || !container.value) {
    status.value = 'error'
    errorMsg.value = t('sessions.missingConfig')
    return
  }
  try {
    rfb = new RFB(container.value, cfg.wsUrl, {
      credentials: cfg.password ? { password: cfg.password } : undefined
    })
    rfb.scaleViewport = true
    // Canvas arka planı tema yüzey rengini izler (workbench temasıyla tutarlı).
    rfb.background = getComputedStyle(container.value).backgroundColor || 'rgb(15, 17, 21)'
    rfb.addEventListener('connect', () => (status.value = 'connected'))
    rfb.addEventListener('disconnect', (e: CustomEvent) => {
      if (!e.detail?.clean && status.value !== 'connected') {
        status.value = 'error'
        errorMsg.value = t('sessions.disconnected')
      }
    })
    rfb.addEventListener('securityfailure', (e: CustomEvent) => {
      status.value = 'error'
      errorMsg.value = e.detail?.reason ?? t('sessions.securityFailure')
    })
  } catch (err) {
    status.value = 'error'
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
})

onBeforeUnmount(() => {
  try {
    rfb?.disconnect()
  } catch {
    // yoksay
  }
  rfb = null
})
</script>

<template>
  <div class="fill-height position-relative">
    <div ref="container" class="remote-canvas" />
    <div
      v-if="status !== 'connected'"
      class="d-flex flex-column align-center justify-center fill-height overlay"
    >
      <template v-if="status === 'connecting'">
        <v-progress-circular indeterminate color="primary" />
        <div class="mt-3 text-body-2">{{ t('sessions.connecting') }}</div>
      </template>
      <template v-else>
        <v-icon icon="mdi-alert-circle-outline" color="error" size="48" />
        <div class="mt-3 text-body-2 text-error">{{ errorMsg }}</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.remote-canvas {
  width: 100%;
  height: 100%;
  background: rgb(var(--v-theme-surface));
}
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(var(--v-theme-surface), 0.85);
}
</style>
