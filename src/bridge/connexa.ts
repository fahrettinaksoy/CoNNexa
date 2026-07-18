/**
 * Connexa köprüsü — arayüzün `window.connexa` API'sini Rust arka uca bağlar.
 * Tüm çağrı yüzeyi (vault/sessions/sftp/...) `@tauri-apps/api` invoke/listen
 * üzerinden çalışır.
 *
 * Kanal adları Rust `#[tauri::command]` adlarına (snake_case) eşlenir; Tauri
 * JS'teki camelCase argümanları otomatik snake_case'e çevirir.
 */
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type {
  Host,
  Group,
  Snippet,
  Tunnel,
  SyncConfigInput,
  SyncConfigPublic,
  SyncResult,
  HostMetrics,
  AlarmConfig,
  AiConfigPublic,
  AiConfigInput,
  PluginResult,
  TeamVaultPublic,
  TeamVaultInput,
  TeamVaultResult,
  IdentitySaveRequest,
  CreateSessionRequest,
  CreateSessionResult,
  VaultData,
  IdentityPublic,
  SftpEntry,
  SftpResult,
  ImportSummary
} from '@shared/types'

interface TunnelResult {
  ok: boolean
  error?: string
}

/**
 * `listen()` bir `Promise<UnlistenFn>` döndürür ama arayüzdeki `on*`
 * metotları SENKRON bir disposer bekler (AiAssistantDialog bunu bir
 * diziye toplayıp `onBeforeUnmount`'ta çağırıyor). Bu sarmalayıcı senkron bir
 * disposer döndürür; abonelik henüz kurulmadan disposer çağrılırsa kurulur
 * kurulmaz iptal edilir.
 */
function onEvent<T>(name: string, handler: (payload: T) => void): () => void {
  let unlisten: UnlistenFn | undefined
  let disposed = false
  void listen<T>(name, (e) => handler(e.payload)).then((un) => {
    if (disposed) un()
    else unlisten = un
  })
  return () => {
    disposed = true
    unlisten?.()
  }
}

// Rust event yükleri (emit ile gönderilir)
interface SessionOutputPayload {
  id: string
  data: string
}
interface SessionExitPayload {
  id: string
  message?: string
}
interface TunnelStatePayload {
  tunnelId: string
  running: boolean
  error?: string
}
interface AiDeltaPayload {
  requestId: string
  text: string
}
interface AiDonePayload {
  requestId: string
}
interface AiErrorPayload {
  requestId: string
  message: string
}

const api = {
  vault: {
    get: (): Promise<VaultData> => invoke('vault_get'),
    saveHost: (host: Host): Promise<Host> => invoke('vault_save_host', { host }),
    deleteHost: (id: string): Promise<void> => invoke('vault_delete_host', { id }),
    saveIdentity: (req: IdentitySaveRequest): Promise<IdentityPublic> =>
      invoke('vault_save_identity', { req }),
    deleteIdentity: (id: string): Promise<void> => invoke('vault_delete_identity', { id }),
    saveGroup: (group: Group): Promise<Group> => invoke('vault_save_group', { group }),
    deleteGroup: (id: string): Promise<void> => invoke('vault_delete_group', { id }),
    saveSnippet: (snippet: Snippet): Promise<Snippet> => invoke('vault_save_snippet', { snippet }),
    deleteSnippet: (id: string): Promise<void> => invoke('vault_delete_snippet', { id }),
    saveTunnel: (tunnel: Tunnel): Promise<Tunnel> => invoke('vault_save_tunnel', { tunnel }),
    deleteTunnel: (id: string): Promise<void> => invoke('vault_delete_tunnel', { id })
  },
  sessions: {
    create: (req: CreateSessionRequest): Promise<CreateSessionResult> =>
      invoke('session_create', { req }),
    write: (id: string, data: string): void => {
      void invoke('session_write', { id, data })
    },
    resize: (id: string, cols: number, rows: number): void => {
      void invoke('session_resize', { id, cols, rows })
    },
    close: (id: string): void => {
      void invoke('session_close', { id })
    },
    onOutput: (cb: (id: string, data: string) => void): (() => void) =>
      onEvent<SessionOutputPayload>('session:output', (p) => cb(p.id, p.data)),
    onExit: (cb: (id: string, message?: string) => void): (() => void) =>
      onEvent<SessionExitPayload>('session:exit', (p) => cb(p.id, p.message))
  },
  sftp: {
    home: (sessionId: string): Promise<SftpResult<string>> => invoke('sftp_home', { sessionId }),
    list: (sessionId: string, path: string): Promise<SftpResult<SftpEntry[]>> =>
      invoke('sftp_list', { sessionId, path }),
    mkdir: (sessionId: string, path: string): Promise<SftpResult> =>
      invoke('sftp_mkdir', { sessionId, path }),
    rename: (sessionId: string, from: string, to: string): Promise<SftpResult> =>
      invoke('sftp_rename', { sessionId, from, to }),
    delete: (sessionId: string, path: string, isDir: boolean): Promise<SftpResult> =>
      invoke('sftp_delete', { sessionId, path, isDir }),
    download: (sessionId: string, remotePath: string): Promise<SftpResult<string>> =>
      invoke('sftp_download', { sessionId, remotePath }),
    upload: (sessionId: string, remoteDir: string): Promise<SftpResult<string[]>> =>
      invoke('sftp_upload', { sessionId, remoteDir })
  },
  importer: {
    sshConfig: (): Promise<ImportSummary> => invoke('import_ssh_config'),
    mremoteng: (): Promise<ImportSummary> => invoke('import_mremoteng'),
    termius: (): Promise<ImportSummary> => invoke('import_termius')
  },
  tunnels: {
    running: (): Promise<string[]> => invoke('tunnel_running'),
    start: (tunnelId: string): Promise<TunnelResult> => invoke('tunnel_start', { tunnelId }),
    stop: (tunnelId: string): Promise<void> => invoke('tunnel_stop', { tunnelId }),
    onState: (cb: (tunnelId: string, running: boolean, error?: string) => void): (() => void) =>
      onEvent<TunnelStatePayload>('tunnel:state', (p) => cb(p.tunnelId, p.running, p.error))
  },
  sync: {
    getConfig: (): Promise<SyncConfigPublic> => invoke('sync_get_config'),
    saveConfig: (input: SyncConfigInput): Promise<void> => invoke('sync_save_config', { input }),
    push: (passphrase: string): Promise<SyncResult> => invoke('sync_push', { passphrase }),
    pull: (passphrase: string): Promise<SyncResult> => invoke('sync_pull', { passphrase })
  },
  rdp: {
    launchExternal: (hostId: string): Promise<{ ok: boolean; error?: string }> =>
      invoke('rdp_launch_external', { hostId })
  },
  metrics: {
    snapshot: (sessionId: string): Promise<HostMetrics> => invoke('metrics_snapshot', { sessionId })
  },
  recording: {
    start: (
      sessionId: string,
      title: string,
      cols: number,
      rows: number
    ): Promise<{ ok: boolean; error?: string; filePath?: string }> =>
      invoke('recording_start', { sessionId, title, cols, rows }),
    stop: (sessionId: string): Promise<{ ok: boolean; filePath?: string }> =>
      invoke('recording_stop', { sessionId }),
    active: (): Promise<string[]> => invoke('recording_active'),
    openFolder: (): Promise<void> => invoke('recording_open_folder')
  },
  cloud: {
    import: (
      provider: 'digitalocean' | 'hetzner',
      token: string,
      identityId?: string
    ): Promise<ImportSummary> => invoke('cloud_import', { provider, token, identityId })
  },
  alarm: {
    getConfig: (): Promise<AlarmConfig> => invoke('alarm_get_config'),
    saveConfig: (config: AlarmConfig): Promise<void> => invoke('alarm_save_config', { config }),
    test: (config: AlarmConfig): Promise<{ ok: boolean; error?: string }> =>
      invoke('alarm_test', { config })
  },
  ai: {
    getConfig: (): Promise<AiConfigPublic> => invoke('ai_get_config'),
    saveConfig: (input: AiConfigInput): Promise<void> => invoke('ai_save_config', { input }),
    ask: (requestId: string, prompt: string, context?: string): void => {
      void invoke('ai_ask', { requestId, prompt, context })
    },
    cancel: (requestId: string): void => {
      void invoke('ai_cancel', { requestId })
    },
    onDelta: (cb: (requestId: string, text: string) => void): (() => void) =>
      onEvent<AiDeltaPayload>('ai:delta', (p) => cb(p.requestId, p.text)),
    onDone: (cb: (requestId: string) => void): (() => void) =>
      onEvent<AiDonePayload>('ai:done', (p) => cb(p.requestId)),
    onError: (cb: (requestId: string, message: string) => void): (() => void) =>
      onEvent<AiErrorPayload>('ai:error', (p) => cb(p.requestId, p.message))
  },
  plugins: {
    list: (): Promise<PluginResult> => invoke('plugins_list'),
    install: (): Promise<PluginResult> => invoke('plugins_install'),
    remove: (id: string): Promise<PluginResult> => invoke('plugins_remove', { id }),
    openFolder: (): Promise<void> => invoke('plugins_open_folder')
  },
  team: {
    list: (): Promise<TeamVaultPublic[]> => invoke('team_list'),
    save: (input: TeamVaultInput): Promise<unknown> => invoke('team_save', { input }),
    delete: (id: string): Promise<void> => invoke('team_delete', { id }),
    assign: (
      kind: 'host' | 'group' | 'snippet' | 'identity',
      itemId: string,
      teamId: string | null
    ): Promise<void> => invoke('team_assign', { kind, itemId, teamId }),
    push: (teamId: string, passphrase: string): Promise<TeamVaultResult> =>
      invoke('team_push', { teamId, passphrase }),
    pull: (teamId: string, passphrase: string): Promise<TeamVaultResult> =>
      invoke('team_pull', { teamId, passphrase })
  }
}

export type ConnexaApi = typeof api

/** `window.connexa`'yı kurar — main.ts'te mount'tan önce çağrılır. */
export function installConnexaBridge(): void {
  ;(window as unknown as { connexa: ConnexaApi }).connexa = api
}
