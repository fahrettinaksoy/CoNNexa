<script setup lang="ts">
import type { SftpEntry } from '@shared/types'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LtrRegion from '@/components/LtrRegion.vue'

const props = defineProps<{ sessionId: string }>()

const { t } = useI18n()

const cwd = ref('')
const entries = ref<SftpEntry[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

const mkdirDialog = ref(false)
const mkdirName = ref('')
const renameDialog = ref(false)
const renameTarget = ref<SftpEntry | null>(null)
const renameName = ref('')

const parentPath = computed(() => {
  if (cwd.value === '/' || cwd.value === '') return null
  const idx = cwd.value.lastIndexOf('/')
  return idx <= 0 ? '/' : cwd.value.slice(0, idx)
})

// Hızlı dizin değişimlerinde son isteğin kazanması için sıra jetonu.
let loadToken = 0

async function load(path: string): Promise<void> {
  const token = ++loadToken
  loading.value = true
  error.value = null
  const result = await window.connexa.sftp.list(props.sessionId, path)
  // Bu istek beklerken daha yeni bir load başladıysa sonucu yoksay (stale önleme).
  if (token !== loadToken) return
  loading.value = false
  if (!result.ok) {
    error.value = result.error ?? t('sftp.error')
    return
  }
  cwd.value = path
  entries.value = result.data ?? []
}

onMounted(async () => {
  loading.value = true
  const home = await window.connexa.sftp.home(props.sessionId)
  if (!home.ok || !home.data) {
    loading.value = false
    error.value = home.error ?? t('sftp.unavailable')
    return
  }
  await load(home.data)
})

function open(entry: SftpEntry): void {
  if (entry.type === 'dir') load(entry.path)
}

async function download(entry: SftpEntry): Promise<void> {
  const result = await window.connexa.sftp.download(props.sessionId, entry.path)
  if (!result.ok) error.value = result.error ?? t('sftp.downloadFailed')
  else if (result.data) notice.value = t('sftp.downloaded', { path: result.data })
}

async function upload(): Promise<void> {
  const result = await window.connexa.sftp.upload(props.sessionId, cwd.value)
  if (!result.ok) error.value = result.error ?? t('sftp.uploadFailed')
  else if (result.data && result.data.length > 0) {
    notice.value = t('sftp.uploaded', { count: result.data.length })
    await load(cwd.value)
  }
}

async function remove(entry: SftpEntry): Promise<void> {
  const result = await window.connexa.sftp.delete(props.sessionId, entry.path, entry.type === 'dir')
  if (!result.ok) error.value = result.error ?? t('sftp.deleteFailed')
  else await load(cwd.value)
}

async function confirmMkdir(): Promise<void> {
  const name = mkdirName.value.trim()
  if (!name) return
  const path = cwd.value === '/' ? `/${name}` : `${cwd.value}/${name}`
  const result = await window.connexa.sftp.mkdir(props.sessionId, path)
  mkdirDialog.value = false
  mkdirName.value = ''
  if (!result.ok) error.value = result.error ?? t('sftp.mkdirFailed')
  else await load(cwd.value)
}

function startRename(entry: SftpEntry): void {
  renameTarget.value = entry
  renameName.value = entry.name
  renameDialog.value = true
}

async function confirmRename(): Promise<void> {
  const target = renameTarget.value
  const name = renameName.value.trim()
  renameDialog.value = false
  if (!target || !name || name === target.name) return
  const dir = target.path.slice(0, target.path.lastIndexOf('/')) || '/'
  const to = dir === '/' ? `/${name}` : `${dir}/${name}`
  const result = await window.connexa.sftp.rename(props.sessionId, target.path, to)
  if (!result.ok) error.value = result.error ?? t('sftp.renameFailed')
  else await load(cwd.value)
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const entryIcon: Record<string, string> = {
  dir: 'mdi-folder',
  file: 'mdi-file-outline',
  link: 'mdi-link-variant'
}
</script>

<template>
  <!-- Dosya yolları/adları teknik içeriktir: RTL dilde bile LTR yalıtılır.
       Diyaloglar overlay'e teleport edildiğinden bu yönden etkilenmez. -->
  <LtrRegion>
    <div class="d-flex flex-column fill-height sftp-panel">
      <div class="d-flex align-center px-2 py-1 flex-grow-0">
        <v-defaults-provider :defaults="{ VBtn: { size: 'x-small', variant: 'text' } }">
          <v-btn
            icon="mdi-arrow-up"
            :disabled="!parentPath"
            :title="t('sftp.up')"
            @click="parentPath !== null ? load(parentPath) : undefined"
          />
          <v-btn icon="mdi-refresh" :title="t('sftp.refresh')" @click="load(cwd)" />
          <v-btn
            icon="mdi-folder-plus-outline"
            :title="t('sftp.newFolder')"
            @click="mkdirDialog = true"
          />
          <v-btn icon="mdi-upload" :title="t('sftp.upload')" @click="upload" />
        </v-defaults-provider>
        <div class="text-caption text-truncate ml-1" :title="cwd">{{ cwd }}</div>
      </div>
      <v-divider />

      <v-progress-linear v-if="loading" indeterminate height="2" />

      <div class="flex-grow-1 overflow-y-auto">
        <v-list nav class="py-0">
          <v-list-item
            v-for="entry in entries"
            :key="entry.path"
            :title="entry.name"
            :subtitle="entry.type === 'file' ? formatSize(entry.size) : undefined"
            @dblclick="open(entry)"
          >
            <template #prepend>
              <v-icon
                :icon="entryIcon[entry.type]"
                size="small"
                :color="entry.type === 'dir' ? 'primary' : undefined"
              />
            </template>
            <template #append>
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
                  <v-list-item
                    v-if="entry.type !== 'dir'"
                    :title="t('sftp.download')"
                    prepend-icon="mdi-download"
                    @click="download(entry)"
                  />
                  <v-list-item
                    :title="t('sftp.rename')"
                    prepend-icon="mdi-rename-box-outline"
                    @click="startRename(entry)"
                  />
                  <v-list-item
                    :title="t('common.delete')"
                    prepend-icon="mdi-delete-outline"
                    base-color="error"
                    @click="remove(entry)"
                  />
                </v-list>
              </v-menu>
            </template>
          </v-list-item>
        </v-list>
        <div v-if="!loading && entries.length === 0" class="text-caption text-medium-emphasis pa-3">
          {{ t('sftp.emptyDir') }}
        </div>
      </div>

      <!-- Yeni klasör -->
      <v-dialog v-model="mkdirDialog" max-width="360">
        <v-card :title="t('sftp.newFolder')">
          <v-card-text>
            <v-text-field
              v-model="mkdirName"
              :label="t('sftp.folderName')"
              autofocus
              @keyup.enter="confirmMkdir"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="mkdirDialog = false">{{ t('common.cancel') }}</v-btn>
            <v-btn color="primary" variant="flat" @click="confirmMkdir">{{
              t('common.save')
            }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Yeniden adlandır -->
      <v-dialog v-model="renameDialog" max-width="360">
        <v-card :title="t('sftp.rename')">
          <v-card-text>
            <v-text-field v-model="renameName" autofocus @keyup.enter="confirmRename" />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="renameDialog = false">{{ t('common.cancel') }}</v-btn>
            <v-btn color="primary" variant="flat" @click="confirmRename">{{
              t('common.save')
            }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar
        :model-value="error !== null"
        color="error"
        timeout="5000"
        @update:model-value="error = null"
      >
        {{ error }}
      </v-snackbar>
      <v-snackbar
        :model-value="notice !== null"
        color="success"
        timeout="3000"
        @update:model-value="notice = null"
      >
        {{ notice }}
      </v-snackbar>
    </div>
  </LtrRegion>
</template>

<style scoped>
.sftp-panel {
  width: 320px;
  min-width: 320px;
}
</style>
