import { defineStore } from 'pinia'
import { ref, computed, shallowReactive } from 'vue'
import type { SessionDescriptor, Protocol } from '@shared/types'

export interface OpenSession extends SessionDescriptor {
  status: 'connected' | 'closed'
  exitMessage?: string
}

export type SplitDirection = 'row' | 'col'

/**
 * Bir sekme. Tek oturum veya split ile yan yana/alt alta birden çok oturum
 * (pane) içerir. paneIds sırası ekrandaki dizilimdir; activePaneId odaklı pane.
 */
export interface PaneGroup {
  id: string
  direction: SplitDirection
  paneIds: string[]
  activePaneId: string
}

type OutputHandler = (data: string) => void

/** Klavye girişi kabul eden (yazılabilir) protokoller */
const TERMINAL_PROTOCOLS: Protocol[] = ['ssh', 'telnet', 'local', 'serial']
const isTerminal = (p: Protocol): boolean => TERMINAL_PROTOCOLS.includes(p)

let groupSeq = 0

/**
 * Oturum görünüm durumu. Gerçek oturumlar main süreçte yaşar; burada sekmeler
 * (pane grupları), aktif oturum ve xterm'e veri yönlendirme tutulur.
 * Terminal bileşeni mount olmadan gelen çıktı buffer'da bekletilir.
 */
export const useSessionsStore = defineStore('sessions', () => {
  const open = ref<OpenSession[]>([])
  const groups = ref<PaneGroup[]>([])
  const activeGroupId = ref<string | null>(null)
  const activeId = ref<string | null>(null)
  /** Broadcast modu: bir terminale yazılan girdi tüm terminal oturumlarına gider */
  const broadcast = ref(false)

  const activeSession = computed(() => open.value.find((s) => s.id === activeId.value) ?? null)
  const activeGroup = computed(() => groups.value.find((g) => g.id === activeGroupId.value) ?? null)

  const liveTerminalIds = computed(() =>
    open.value.filter((s) => isTerminal(s.protocol) && s.status === 'connected').map((s) => s.id)
  )

  const handlers = shallowReactive(new Map<string, OutputHandler>())
  const buffers = new Map<string, string[]>()
  let subscribed = false

  function sessionById(id: string): OpenSession | undefined {
    return open.value.find((s) => s.id === id)
  }

  function groupTitle(group: PaneGroup): string {
    const active = sessionById(group.activePaneId)
    const base = active?.title ?? '—'
    return group.paneIds.length > 1 ? `${base} +${group.paneIds.length - 1}` : base
  }

  function ensureSubscribed(): void {
    if (subscribed) return
    subscribed = true
    window.connexa.sessions.onOutput((id, data) => {
      const handler = handlers.get(id)
      if (handler) handler(data)
      else {
        if (!buffers.has(id)) buffers.set(id, [])
        buffers.get(id)!.push(data)
      }
    })
    window.connexa.sessions.onExit((id, message) => {
      const session = sessionById(id)
      if (session) {
        session.status = 'closed'
        session.exitMessage = message
      }
    })
  }

  function registerHandler(id: string, handler: OutputHandler): void {
    handlers.set(id, handler)
    const buffered = buffers.get(id)
    if (buffered) {
      buffers.delete(id)
      for (const chunk of buffered) handler(chunk)
    }
  }

  function unregisterHandler(id: string): void {
    handlers.delete(id)
  }

  /** Oturumu main'de açar; grup oluşturmaz. Dönüş: sessionId veya hata mesajı. */
  async function createSession(
    req: { local: true } | { hostId: string }
  ): Promise<{ id: string } | { error: string }> {
    ensureSubscribed()
    const result = await window.connexa.sessions.create({ ...req, cols: 80, rows: 24 })
    if (!result.ok || !result.session) return { error: result.error ?? 'unknown error' }
    open.value.push({ ...result.session, status: 'connected' })
    return { id: result.session.id }
  }

  function newGroup(sessionId: string): void {
    const group: PaneGroup = {
      id: `g${++groupSeq}`,
      direction: 'row',
      paneIds: [sessionId],
      activePaneId: sessionId
    }
    groups.value.push(group)
    activeGroupId.value = group.id
    activeId.value = sessionId
  }

  async function openLocal(): Promise<string | null> {
    const res = await createSession({ local: true })
    if ('error' in res) return res.error
    newGroup(res.id)
    return null
  }

  async function openForHost(hostId: string): Promise<string | null> {
    const res = await createSession({ hostId })
    if ('error' in res) return res.error
    newGroup(res.id)
    return null
  }

  /** Odaklı sekmeyi böler: aktif pane'in oturumunu çoğaltıp gruba ekler. */
  async function splitActive(direction: SplitDirection): Promise<string | null> {
    const group = activeGroup.value
    const source = activeSession.value
    if (!group || !source) return null
    // Terminal oturumu ise aynı host/local; değilse split desteklenmez
    if (!isTerminal(source.protocol)) return null
    const res =
      source.hostId && source.protocol !== 'local'
        ? await createSession({ hostId: source.hostId })
        : await createSession({ local: true })
    if ('error' in res) return res.error
    group.direction = direction
    group.paneIds.push(res.id)
    group.activePaneId = res.id
    activeId.value = res.id
    return null
  }

  function setActivePane(groupId: string, sessionId: string): void {
    const group = groups.value.find((g) => g.id === groupId)
    if (!group) return
    activeGroupId.value = groupId
    group.activePaneId = sessionId
    activeId.value = sessionId
  }

  function selectGroup(groupId: string): void {
    const group = groups.value.find((g) => g.id === groupId)
    if (!group) return
    activeGroupId.value = groupId
    activeId.value = group.activePaneId
  }

  /**
   * TerminalPane'den gelen klavye girdisi. Broadcast açıksa ve kaynak bir
   * terminal oturumuysa girdi tüm canlı terminal oturumlarına yansıtılır.
   */
  function writeInput(sourceId: string, data: string): void {
    const source = sessionById(sourceId)
    if (broadcast.value && source && isTerminal(source.protocol)) {
      for (const id of liveTerminalIds.value) window.connexa.sessions.write(id, data)
    } else {
      window.connexa.sessions.write(sourceId, data)
    }
  }

  /**
   * Snippet komutunu çalıştırır. Broadcast açıkken tüm terminal oturumlarına,
   * kapalıyken yalnızca aktif terminal oturumuna gönderir. Komut sonuna \n eklenir.
   * Dönüş: hedef oturum sayısı (0 ise yazılabilir oturum yok).
   */
  function runCommand(command: string): number {
    const line = command.endsWith('\n') ? command : command + '\n'
    if (broadcast.value) {
      const ids = liveTerminalIds.value
      for (const id of ids) window.connexa.sessions.write(id, line)
      return ids.length
    }
    const active = activeSession.value
    if (active && isTerminal(active.protocol) && active.status === 'connected') {
      window.connexa.sessions.write(active.id, line)
      return 1
    }
    return 0
  }

  function disposeSession(id: string): void {
    window.connexa.sessions.close(id)
    unregisterHandler(id)
    buffers.delete(id)
    const idx = open.value.findIndex((s) => s.id === id)
    if (idx >= 0) open.value.splice(idx, 1)
  }

  /** Tek pane'i kapatır; grubu boşalırsa grubu da kaldırır. */
  function closePane(sessionId: string): void {
    const group = groups.value.find((g) => g.paneIds.includes(sessionId))
    disposeSession(sessionId)
    if (!group) return
    const paneIdx = group.paneIds.indexOf(sessionId)
    group.paneIds.splice(paneIdx, 1)
    if (group.paneIds.length === 0) {
      removeGroup(group.id)
    } else if (group.activePaneId === sessionId) {
      const next = group.paneIds[Math.max(0, paneIdx - 1)]
      group.activePaneId = next
      if (activeGroupId.value === group.id) activeId.value = next
    }
  }

  /** Sekmenin tamamını (tüm pane'leri) kapatır. */
  function closeGroup(groupId: string): void {
    const group = groups.value.find((g) => g.id === groupId)
    if (!group) return
    for (const id of [...group.paneIds]) disposeSession(id)
    removeGroup(groupId)
  }

  function removeGroup(groupId: string): void {
    const idx = groups.value.findIndex((g) => g.id === groupId)
    if (idx < 0) return
    groups.value.splice(idx, 1)
    if (activeGroupId.value === groupId) {
      const next = groups.value[Math.max(0, idx - 1)]
      activeGroupId.value = next?.id ?? null
      activeId.value = next ? next.activePaneId : null
    }
  }

  return {
    open,
    groups,
    activeGroupId,
    activeId,
    broadcast,
    activeSession,
    activeGroup,
    liveTerminalIds,
    groupTitle,
    sessionById,
    openLocal,
    openForHost,
    splitActive,
    setActivePane,
    selectGroup,
    writeInput,
    runCommand,
    closePane,
    closeGroup,
    registerHandler,
    unregisterHandler
  }
})
