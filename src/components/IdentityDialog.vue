<script setup lang="ts">
import type { IdentityPublic, IdentitySaveRequest, SecretManager } from '@shared/types'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CrudDialog from '@/components/CrudDialog.vue'
import { useRules } from '@/composables/rules'
import { useVaultStore } from '@/stores/vault'

const props = defineProps<{ identity?: IdentityPublic | null }>()
const model = defineModel<boolean>({ default: false })
const { t } = useI18n()
const vault = useVaultStore()
const { required } = useRules()

const form = ref<IdentitySaveRequest>(emptyForm())
/** Parola kaynağı: vault'ta saklanan mı yoksa harici yöneticiden mi */
const passwordSource = ref<'stored' | SecretManager>('stored')
const secretRefValue = ref('')

function emptyForm(): IdentitySaveRequest {
  return { name: '', username: '', authType: 'password' }
}

watch(model, (openNow) => {
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
})

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

async function save(): Promise<void> {
  // Parola kaynağını secretRef alanına dönüştür
  if (form.value.authType === 'password' && passwordSource.value !== 'stored') {
    form.value.secretRef = { manager: passwordSource.value, ref: secretRefValue.value.trim() }
    form.value.password = undefined
  } else {
    form.value.secretRef = null
  }
  await vault.saveIdentity(form.value)
  model.value = false
}
</script>

<template>
  <CrudDialog
    v-model="model"
    :title="identity ? t('identities.edit') : t('identities.add')"
    :max-width="480"
    @save="save"
  >
    <v-text-field v-model="form.name" :label="t('identities.name')" :rules="[required]" autofocus />
    <v-text-field v-model="form.username" :label="t('identities.username')" :rules="[required]" />
    <v-select v-model="form.authType" :items="authItems" :label="t('identities.authType')" />
    <template v-if="form.authType === 'password'">
      <v-select
        v-model="passwordSource"
        :items="passwordSourceItems"
        :label="t('identities.passwordSource')"
      />
      <v-text-field
        v-if="passwordSource === 'stored'"
        v-model="form.password"
        :label="identity?.hasPassword ? t('identities.passwordKeep') : t('identities.password')"
        type="password"
      />
      <v-text-field
        v-else
        v-model="secretRefValue"
        :label="t('identities.secretRef')"
        :placeholder="secretRefPlaceholder"
      />
    </template>
    <template v-if="form.authType === 'key'">
      <v-text-field
        v-model="form.privateKeyPath"
        :label="t('identities.privateKeyPath')"
        placeholder="~/.ssh/id_ed25519"
      />
      <v-text-field v-model="form.passphrase" :label="t('identities.passphrase')" type="password" />
    </template>
    <div class="text-caption text-medium-emphasis mt-1">
      <v-icon icon="mdi-shield-lock-outline" size="small" class="mr-1" />
      {{ t('identities.secure') }}
    </div>
  </CrudDialog>
</template>
