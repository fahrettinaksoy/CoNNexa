import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Host, Group, Snippet, Tunnel, IdentityPublic, IdentitySaveRequest } from '@shared/types'

export const useVaultStore = defineStore('vault', () => {
  const hosts = ref<Host[]>([])
  const identities = ref<IdentityPublic[]>([])
  const groups = ref<Group[]>([])
  const snippets = ref<Snippet[]>([])
  const tunnels = ref<Tunnel[]>([])
  const loaded = ref(false)

  async function load(): Promise<void> {
    const data = await window.connexa.vault.get()
    hosts.value = data.hosts
    identities.value = data.identities
    groups.value = data.groups
    snippets.value = data.snippets
    tunnels.value = data.tunnels
    loaded.value = true
  }

  async function saveHost(host: Host): Promise<void> {
    await window.connexa.vault.saveHost(JSON.parse(JSON.stringify(host)))
    await load()
  }

  async function deleteHost(id: string): Promise<void> {
    await window.connexa.vault.deleteHost(id)
    await load()
  }

  async function saveIdentity(req: IdentitySaveRequest): Promise<void> {
    await window.connexa.vault.saveIdentity(JSON.parse(JSON.stringify(req)))
    await load()
  }

  async function deleteIdentity(id: string): Promise<void> {
    await window.connexa.vault.deleteIdentity(id)
    await load()
  }

  async function saveGroup(group: Group): Promise<void> {
    await window.connexa.vault.saveGroup(JSON.parse(JSON.stringify(group)))
    await load()
  }

  async function deleteGroup(id: string): Promise<void> {
    await window.connexa.vault.deleteGroup(id)
    await load()
  }

  async function saveSnippet(snippet: Snippet): Promise<void> {
    await window.connexa.vault.saveSnippet(JSON.parse(JSON.stringify(snippet)))
    await load()
  }

  async function deleteSnippet(id: string): Promise<void> {
    await window.connexa.vault.deleteSnippet(id)
    await load()
  }

  /** parentId → alt gruplar (kök için undefined anahtarı) */
  const groupsByParent = computed(() => {
    const map = new Map<string | undefined, Group[]>()
    for (const group of groups.value) {
      const key = group.parentId
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(group)
    }
    return map
  })

  const hostsByGroup = computed(() => {
    const map = new Map<string | undefined, Host[]>()
    for (const host of hosts.value) {
      const key = host.groupId
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(host)
    }
    return map
  })

  function identityName(id?: string): string {
    if (!id) return ''
    return identities.value.find((i) => i.id === id)?.name ?? ''
  }

  return {
    hosts,
    identities,
    groups,
    snippets,
    tunnels,
    loaded,
    hostsByGroup,
    groupsByParent,
    load,
    saveHost,
    deleteHost,
    saveIdentity,
    deleteIdentity,
    saveGroup,
    deleteGroup,
    saveSnippet,
    deleteSnippet,
    identityName
  }
})
