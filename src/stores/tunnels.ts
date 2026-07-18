import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

/**
 * Tünel çalışma durumu. Tünel tanımları vault store'da tutulur; burada yalnızca
 * hangi tünelin çalıştığı ve son hata mesajı izlenir (main süreçten olay ile).
 */
export const useTunnelsStore = defineStore('tunnels', () => {
  const running = reactive(new Set<string>())
  const errors = reactive(new Map<string, string>())
  let subscribed = false

  async function init(): Promise<void> {
    if (subscribed) return
    subscribed = true
    window.connexa.tunnels.onState((tunnelId, isRunning, error) => {
      if (isRunning) {
        running.add(tunnelId)
        errors.delete(tunnelId)
      } else {
        running.delete(tunnelId)
        if (error) errors.set(tunnelId, error)
      }
    })
    for (const id of await window.connexa.tunnels.running()) running.add(id)
  }

  const busy = ref(false)

  async function start(tunnelId: string): Promise<string | null> {
    busy.value = true
    const result = await window.connexa.tunnels.start(tunnelId)
    busy.value = false
    if (!result.ok) {
      errors.set(tunnelId, result.error ?? 'unknown error')
      return result.error ?? 'unknown error'
    }
    return null
  }

  async function stop(tunnelId: string): Promise<void> {
    await window.connexa.tunnels.stop(tunnelId)
  }

  function isRunning(tunnelId: string): boolean {
    return running.has(tunnelId)
  }

  return { running, errors, busy, init, start, stop, isRunning }
})
