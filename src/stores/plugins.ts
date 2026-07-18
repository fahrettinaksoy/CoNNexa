import type { PluginInfo, Snippet } from '@shared/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Yüklü plugin'ler ve kattıkları snippet'ler. Plugin snippet'leri salt okunurdur
 * ve komut paletinde kullanılabilir.
 */
export const usePluginsStore = defineStore('plugins', () => {
  const plugins = ref<PluginInfo[]>([])
  const snippets = ref<Snippet[]>([])
  const error = ref<string | null>(null)
  let loaded = false

  function apply(result: {
    ok: boolean
    error?: string
    plugins: PluginInfo[]
    snippets: Snippet[]
  }): void {
    plugins.value = result.plugins
    snippets.value = result.snippets
    error.value = result.ok ? null : (result.error ?? 'error')
  }

  async function load(): Promise<void> {
    if (loaded) return
    loaded = true
    apply(await window.connexa.plugins.list())
  }

  async function install(): Promise<void> {
    apply(await window.connexa.plugins.install())
  }

  async function remove(id: string): Promise<void> {
    apply(await window.connexa.plugins.remove(id))
  }

  function openFolder(): void {
    window.connexa.plugins.openFolder()
  }

  return { plugins, snippets, error, load, install, remove, openFolder }
})
