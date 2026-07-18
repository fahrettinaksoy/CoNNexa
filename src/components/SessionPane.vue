<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSessionsStore } from '@/stores/sessions'
import TerminalPane from './TerminalPane.vue'
import VncPane from './VncPane.vue'
import RdpPane from './RdpPane.vue'
import type { OpenSession } from '@/stores/sessions'

const props = defineProps<{
  session: OpenSession
  groupId: string
  active: boolean
  multi: boolean
}>()

const { t } = useI18n()
const sessions = useSessionsStore()

function focus(): void {
  sessions.setActivePane(props.groupId, props.session.id)
}
</script>

<template>
  <div
    class="session-pane"
    :class="{ 'pane-active': active && multi }"
    @mousedown="focus"
  >
    <div class="pane-body">
      <VncPane v-if="session.protocol === 'vnc'" :session="session" />
      <RdpPane v-else-if="session.protocol === 'rdp'" :session="session" />
      <TerminalPane v-else :session-id="session.id" />
    </div>
    <v-btn
      v-if="multi"
      class="pane-close"
      icon="mdi-close"
      size="x-small"
      variant="tonal"
      :title="t('sessions.close')"
      @click.stop="sessions.closePane(session.id)"
    />
  </div>
</template>

<style scoped>
.session-pane {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid transparent;
}
.pane-active {
  border-color: rgb(var(--v-theme-primary));
}
.pane-body {
  height: 100%;
  width: 100%;
}
.pane-close {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.session-pane:hover .pane-close {
  opacity: 1;
}
</style>
