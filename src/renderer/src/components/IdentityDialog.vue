<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import type { IdentityPublic, IdentitySaveRequest, SecretManager } from '@shared/types'

const props = defineProps<{
  modelValue: boolean
  identity?: IdentityPublic | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()
const vault = useVaultStore()

const form = ref<IdentitySaveRequest>(emptyForm())
/** Parola kaynağı: vault'ta saklanan mı yoksa harici yöneticiden mi */
const passwordSource = ref<'stored' | SecretManager>('stored')
const secretRefValue = ref('')

function emptyForm(): IdentitySaveRequest {
  return { name: '', username: '', authType: 'password' }
}

watch(
  () => props.modelValue,
  (openNow) => {
    if (!openNow) return
    form.value = props.identity
      ? {
          id: props.identity.id,
          name: props.identity.name,
          username: props.identity.username,
          authType: props.identity.authType,
          privateKeyPath: props.identity.privateKeyPath
        }
      : emptyForm()
    passwordSource.value = props.identity?.secretRef?.manager ?? 'stored'
    secretRefValue.value = props.identity?.secretRef?.ref ?? ''
  }
)

const authItems = computed(() => [
  { title: t('identities.authTypes.password'), value: 'password' },
  { title: t('identities.authTypes.key'), value: 'key' },
  { title: t('identities.authTypes.agent'), value: 'agent' }
])

const passwordSourceItems = computed(() => [
  { title: t('identities.passwordSources.stored'), value: 'stored' },
  { title: t('identities.passwordSources.bitwarden'), value: 'bitwarden' },
  { title: t('identities.passwordSources.onepassword'), value: 'onepassword' },
  { title: t('identities.passwordSources.command'), value: 'command' }
])

const secretRefPlaceholder = computed(() => {
  switch (passwordSource.value) {
    case 'bitwarden':
      return 'my-server-login'
    case 'onepassword':
      return 'op://Private/Server/password'
    case 'command':
      return 'keepassxc-cli show -sa Password ~/vault.kdbx Server'
    default:
      return ''
  }
})

const valid = computed(
  () => form.value.name.trim() !== '' && form.value.username.trim() !== ''
)

async function save(): Promise<void> {
  // Parola kaynağını secretRef alanına dönüştür
  if (form.value.authType === 'password' && passwordSource.value !== 'stored') {
    form.value.secretRef = { manager: passwordSource.value, ref: secretRefValue.value.trim() }
    form.value.password = undefined
  } else {
    form.value.secretRef = null
  }
  await vault.saveIdentity(form.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card :title="identity ? t('identities.edit') : t('identities.add')">
      <v-card-text>
        <v-text-field v-model="form.name" :label="t('identities.name')" density="comfortable" />
        <v-text-field
          v-model="form.username"
          :label="t('identities.username')"
          density="comfortable"
        />
        <v-select
          v-model="form.authType"
          :items="authItems"
          :label="t('identities.authType')"
          density="comfortable"
        />
        <template v-if="form.authType === 'password'">
          <v-select
            v-model="passwordSource"
            :items="passwordSourceItems"
            :label="t('identities.passwordSource')"
            density="comfortable"
          />
          <v-text-field
            v-if="passwordSource === 'stored'"
            v-model="form.password"
            :label="identity?.hasPassword ? t('identities.passwordKeep') : t('identities.password')"
            type="password"
            density="comfortable"
          />
          <v-text-field
            v-else
            v-model="secretRefValue"
            :label="t('identities.secretRef')"
            :placeholder="secretRefPlaceholder"
            density="comfortable"
          />
        </template>
        <template v-if="form.authType === 'key'">
          <v-text-field
            v-model="form.privateKeyPath"
            :label="t('identities.privateKeyPath')"
            placeholder="~/.ssh/id_ed25519"
            density="comfortable"
          />
          <v-text-field
            v-model="form.passphrase"
            :label="t('identities.passphrase')"
            type="password"
            density="comfortable"
          />
        </template>
        <div class="text-caption text-medium-emphasis mt-1">
          <v-icon icon="mdi-shield-lock-outline" size="small" class="mr-1" />
          {{ t('identities.secure') }}
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" variant="flat" :disabled="!valid" @click="save">
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
