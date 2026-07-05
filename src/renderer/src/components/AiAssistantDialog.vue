<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionsStore } from '@/stores/sessions'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const { t } = useI18n()
const sessions = useSessionsStore()

const prompt = ref('')
const answer = ref('')
const busy = ref(false)
const errorMsg = ref<string | null>(null)
let currentId: string | null = null
let idSeq = 0

const disposers: Array<() => void> = [
  window.connexa.ai.onDelta((id, text) => {
    if (id === currentId) answer.value += text
  }),
  window.connexa.ai.onDone((id) => {
    if (id === currentId) busy.value = false
  }),
  window.connexa.ai.onError((id, message) => {
    if (id === currentId) {
      busy.value = false
      errorMsg.value = message
    }
  })
]

onBeforeUnmount(() => disposers.forEach((d) => d()))

watch(
  () => props.modelValue,
  (openNow) => {
    if (openNow) {
      answer.value = ''
      errorMsg.value = null
    } else if (currentId) {
      window.connexa.ai.cancel(currentId)
      busy.value = false
    }
  }
)

function ask(): void {
  if (!prompt.value.trim()) return
  answer.value = ''
  errorMsg.value = null
  busy.value = true
  currentId = `ai${++idSeq}`
  window.connexa.ai.ask(currentId, prompt.value.trim())
}

/** Yanıttaki ilk ```...``` kod bloğunu çıkarır */
const extractedCommand = computed(() => {
  const match = answer.value.match(/```(?:bash|sh)?\n([\s\S]*?)```/)
  return match ? match[1].trim() : ''
})

function insertCommand(): void {
  const cmd = extractedCommand.value
  const active = sessions.activeSession
  if (!cmd || !active) return
  window.connexa.sessions.write(active.id, cmd)
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-robot-outline" class="mr-2" />
        {{ t('ai.title') }}
      </v-card-title>
      <v-card-text>
        <v-textarea
          v-model="prompt"
          :label="t('ai.prompt')"
          :placeholder="t('ai.placeholder')"
          rows="2"
          auto-grow
          autofocus
          @keydown.enter.exact.prevent="ask"
        />

        <div v-if="answer" class="ai-answer mt-2">{{ answer }}</div>
        <div v-if="busy && !answer" class="d-flex align-center ga-2 mt-2 text-medium-emphasis">
          <v-progress-circular indeterminate size="18" />
          <span class="text-body-2">{{ t('ai.thinking') }}</span>
        </div>
        <v-alert v-if="errorMsg" type="error" class="mt-2">
          {{ errorMsg }}
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-btn
          v-if="extractedCommand && sessions.activeSession"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-console-line"
          @click="insertCommand"
        >
          {{ t('ai.insert') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" variant="flat" :loading="busy" :disabled="!prompt.trim()" @click="ask">
          {{ t('ai.ask') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.ai-answer {
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.5;
  max-height: 40vh;
  overflow-y: auto;
  background: rgba(127, 127, 127, 0.08);
  border-radius: 6px;
  padding: 10px 12px;
}
</style>
