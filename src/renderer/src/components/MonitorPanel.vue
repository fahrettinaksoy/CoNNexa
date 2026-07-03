<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HostMetrics } from '@shared/types'

const props = defineProps<{ sessionId: string }>()

const { t } = useI18n()

const metrics = ref<HostMetrics | null>(null)
const loading = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

async function refresh(): Promise<void> {
  loading.value = true
  metrics.value = await window.connexa.metrics.snapshot(props.sessionId)
  loading.value = false
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 5000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

function fmtBytes(bytes?: number): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

const memPercent = computed(() => {
  const m = metrics.value
  if (!m?.memTotalBytes || !m.memUsedBytes) return 0
  return Math.round((m.memUsedBytes / m.memTotalBytes) * 100)
})

/** Load average çekirdek sayısına göre yüzde (1 dk) */
const loadPercent = computed(() => {
  const m = metrics.value
  if (!m?.loadAvg || !m.cpuCount) return 0
  return Math.min(100, Math.round((m.loadAvg[0] / m.cpuCount) * 100))
})

function barColor(pct: number): string {
  if (pct >= 90) return 'error'
  if (pct >= 70) return 'warning'
  return 'success'
}
</script>

<template>
  <div class="d-flex flex-column fill-height monitor-panel">
    <div class="d-flex align-center px-3 py-2 flex-grow-0">
      <v-icon icon="mdi-gauge" size="small" class="mr-2" />
      <span class="text-subtitle-2">{{ t('monitor.title') }}</span>
      <v-spacer />
      <v-btn
        icon="mdi-refresh"
        size="x-small"
        variant="text"
        :loading="loading"
        @click="refresh"
      />
    </div>
    <v-divider />

    <div class="flex-grow-1 overflow-y-auto pa-3">
      <template v-if="metrics && !metrics.ok">
        <v-alert type="warning" variant="tonal" density="compact">
          {{ metrics.error || t('monitor.unavailable') }}
        </v-alert>
      </template>

      <template v-else-if="metrics">
        <!-- Uptime -->
        <div class="text-caption text-medium-emphasis mb-1">{{ t('monitor.uptime') }}</div>
        <div class="text-body-2 mb-4">{{ metrics.uptime || '—' }}</div>

        <!-- CPU / load -->
        <div class="d-flex justify-space-between text-caption mb-1">
          <span>{{ t('monitor.cpu') }} ({{ metrics.cpuCount ?? '?' }} {{ t('monitor.cores') }})</span>
          <span>{{ loadPercent }}%</span>
        </div>
        <v-progress-linear
          :model-value="loadPercent"
          :color="barColor(loadPercent)"
          height="8"
          rounded
          class="mb-1"
        />
        <div class="text-caption text-medium-emphasis mb-4">
          load: {{ metrics.loadAvg?.map((n) => n.toFixed(2)).join(' · ') || '—' }}
        </div>

        <!-- Bellek -->
        <div class="d-flex justify-space-between text-caption mb-1">
          <span>{{ t('monitor.memory') }}</span>
          <span>{{ fmtBytes(metrics.memUsedBytes) }} / {{ fmtBytes(metrics.memTotalBytes) }}</span>
        </div>
        <v-progress-linear
          :model-value="memPercent"
          :color="barColor(memPercent)"
          height="8"
          rounded
          class="mb-4"
        />

        <!-- Diskler -->
        <div class="text-caption text-medium-emphasis mb-1">{{ t('monitor.disks') }}</div>
        <div v-for="disk in metrics.disks" :key="disk.mount" class="mb-3">
          <div class="d-flex justify-space-between text-caption mb-1">
            <span class="text-truncate" :title="disk.mount">{{ disk.mount }}</span>
            <span>{{ fmtBytes(disk.usedBytes) }} / {{ fmtBytes(disk.sizeBytes) }}</span>
          </div>
          <v-progress-linear
            :model-value="disk.usePercent"
            :color="barColor(disk.usePercent)"
            height="6"
            rounded
          />
        </div>

        <!-- Süreçler -->
        <div class="text-caption text-medium-emphasis mt-4 mb-1">
          {{ t('monitor.topProcesses') }}
        </div>
        <v-table density="compact" class="proc-table">
          <thead>
            <tr>
              <th>PID</th>
              <th>CPU%</th>
              <th>MEM%</th>
              <th>{{ t('monitor.command') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="proc in metrics.processes" :key="proc.pid">
              <td>{{ proc.pid }}</td>
              <td>{{ proc.cpu.toFixed(1) }}</td>
              <td>{{ proc.mem.toFixed(1) }}</td>
              <td class="text-truncate" :title="proc.command">{{ proc.command }}</td>
            </tr>
          </tbody>
        </v-table>
      </template>

      <div v-else class="d-flex justify-center pa-4">
        <v-progress-circular indeterminate size="24" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.monitor-panel {
  width: 340px;
  min-width: 340px;
}
.proc-table :deep(td),
.proc-table :deep(th) {
  font-size: 11px;
  padding: 0 6px !important;
  height: 24px !important;
}
.proc-table :deep(td:last-child) {
  max-width: 130px;
}
</style>
