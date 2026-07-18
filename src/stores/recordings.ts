import { defineStore } from 'pinia'
import { reactive } from 'vue'

/**
 * Oturum kaydı görünüm durumu. Gerçek kayıt main süreçte yapılır; burada hangi
 * oturumun kaydedildiği ve her terminalin son bilinen boyutu (asciicast başlığı
 * için) tutulur.
 */
export const useRecordingsStore = defineStore('recordings', () => {
  const active = reactive(new Set<string>())
  const sizes = reactive(new Map<string, { cols: number; rows: number }>())
  let initialized = false

  async function init(): Promise<void> {
    if (initialized) return
    initialized = true
    for (const id of await window.connexa.recording.active()) active.add(id)
  }

  function reportSize(sessionId: string, cols: number, rows: number): void {
    sizes.set(sessionId, { cols, rows })
  }

  function isRecording(sessionId: string): boolean {
    return active.has(sessionId)
  }

  async function toggle(sessionId: string, title: string): Promise<string | null> {
    if (active.has(sessionId)) {
      await window.connexa.recording.stop(sessionId)
      active.delete(sessionId)
      return null
    }
    const size = sizes.get(sessionId) ?? { cols: 80, rows: 24 }
    const result = await window.connexa.recording.start(sessionId, title, size.cols, size.rows)
    if (!result.ok) return result.error ?? 'recording failed'
    active.add(sessionId)
    return null
  }

  function openFolder(): void {
    window.connexa.recording.openFolder()
  }

  return { active, init, reportSize, isRecording, toggle, openFolder }
})
