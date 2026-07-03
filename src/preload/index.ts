import { contextBridge, ipcRenderer } from 'electron'
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
} from '../shared/types'

interface TunnelResult {
  ok: boolean
  error?: string
}

const api = {
  vault: {
    get: (): Promise<VaultData> => ipcRenderer.invoke('vault:get'),
    saveHost: (host: Host): Promise<Host> => ipcRenderer.invoke('vault:saveHost', host),
    deleteHost: (id: string): Promise<void> => ipcRenderer.invoke('vault:deleteHost', id),
    saveIdentity: (req: IdentitySaveRequest): Promise<IdentityPublic> =>
      ipcRenderer.invoke('vault:saveIdentity', req),
    deleteIdentity: (id: string): Promise<void> => ipcRenderer.invoke('vault:deleteIdentity', id),
    saveGroup: (group: Group): Promise<Group> => ipcRenderer.invoke('vault:saveGroup', group),
    deleteGroup: (id: string): Promise<void> => ipcRenderer.invoke('vault:deleteGroup', id),
    saveSnippet: (snippet: Snippet): Promise<Snippet> =>
      ipcRenderer.invoke('vault:saveSnippet', snippet),
    deleteSnippet: (id: string): Promise<void> => ipcRenderer.invoke('vault:deleteSnippet', id),
    saveTunnel: (tunnel: Tunnel): Promise<Tunnel> =>
      ipcRenderer.invoke('vault:saveTunnel', tunnel),
    deleteTunnel: (id: string): Promise<void> => ipcRenderer.invoke('vault:deleteTunnel', id)
  },
  sessions: {
    create: (req: CreateSessionRequest): Promise<CreateSessionResult> =>
      ipcRenderer.invoke('session:create', req),
    write: (id: string, data: string): void => ipcRenderer.send('session:write', id, data),
    resize: (id: string, cols: number, rows: number): void =>
      ipcRenderer.send('session:resize', id, cols, rows),
    close: (id: string): void => ipcRenderer.send('session:close', id),
    onOutput: (cb: (id: string, data: string) => void): (() => void) => {
      const listener = (_e: unknown, id: string, data: string): void => cb(id, data)
      ipcRenderer.on('session:output', listener)
      return () => ipcRenderer.removeListener('session:output', listener)
    },
    onExit: (cb: (id: string, message?: string) => void): (() => void) => {
      const listener = (_e: unknown, id: string, message?: string): void => cb(id, message)
      ipcRenderer.on('session:exit', listener)
      return () => ipcRenderer.removeListener('session:exit', listener)
    }
  },
  sftp: {
    home: (sessionId: string): Promise<SftpResult<string>> =>
      ipcRenderer.invoke('sftp:home', sessionId),
    list: (sessionId: string, path: string): Promise<SftpResult<SftpEntry[]>> =>
      ipcRenderer.invoke('sftp:list', sessionId, path),
    mkdir: (sessionId: string, path: string): Promise<SftpResult> =>
      ipcRenderer.invoke('sftp:mkdir', sessionId, path),
    rename: (sessionId: string, from: string, to: string): Promise<SftpResult> =>
      ipcRenderer.invoke('sftp:rename', sessionId, from, to),
    delete: (sessionId: string, path: string, isDir: boolean): Promise<SftpResult> =>
      ipcRenderer.invoke('sftp:delete', sessionId, path, isDir),
    download: (sessionId: string, remotePath: string): Promise<SftpResult<string>> =>
      ipcRenderer.invoke('sftp:download', sessionId, remotePath),
    upload: (sessionId: string, remoteDir: string): Promise<SftpResult<string[]>> =>
      ipcRenderer.invoke('sftp:upload', sessionId, remoteDir)
  },
  importer: {
    sshConfig: (): Promise<ImportSummary> => ipcRenderer.invoke('import:sshConfig'),
    mremoteng: (): Promise<ImportSummary> => ipcRenderer.invoke('import:mremoteng'),
    termius: (): Promise<ImportSummary> => ipcRenderer.invoke('import:termius')
  },
  tunnels: {
    running: (): Promise<string[]> => ipcRenderer.invoke('tunnel:running'),
    start: (tunnelId: string): Promise<TunnelResult> =>
      ipcRenderer.invoke('tunnel:start', tunnelId),
    stop: (tunnelId: string): Promise<void> => ipcRenderer.invoke('tunnel:stop', tunnelId),
    onState: (cb: (tunnelId: string, running: boolean, error?: string) => void): (() => void) => {
      const listener = (_e: unknown, tunnelId: string, running: boolean, error?: string): void =>
        cb(tunnelId, running, error)
      ipcRenderer.on('tunnel:state', listener)
      return () => ipcRenderer.removeListener('tunnel:state', listener)
    }
  },
  sync: {
    getConfig: (): Promise<SyncConfigPublic> => ipcRenderer.invoke('sync:getConfig'),
    saveConfig: (input: SyncConfigInput): Promise<void> =>
      ipcRenderer.invoke('sync:saveConfig', input),
    push: (passphrase: string): Promise<SyncResult> => ipcRenderer.invoke('sync:push', passphrase),
    pull: (passphrase: string): Promise<SyncResult> => ipcRenderer.invoke('sync:pull', passphrase)
  },
  rdp: {
    launchExternal: (hostId: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('rdp:launchExternal', hostId)
  },
  metrics: {
    snapshot: (sessionId: string): Promise<HostMetrics> =>
      ipcRenderer.invoke('metrics:snapshot', sessionId)
  },
  recording: {
    start: (
      sessionId: string,
      title: string,
      cols: number,
      rows: number
    ): Promise<{ ok: boolean; error?: string; filePath?: string }> =>
      ipcRenderer.invoke('recording:start', sessionId, title, cols, rows),
    stop: (sessionId: string): Promise<{ ok: boolean; filePath?: string }> =>
      ipcRenderer.invoke('recording:stop', sessionId),
    active: (): Promise<string[]> => ipcRenderer.invoke('recording:active'),
    openFolder: (): Promise<void> => ipcRenderer.invoke('recording:openFolder')
  },
  cloud: {
    import: (
      provider: 'digitalocean' | 'hetzner',
      token: string,
      identityId?: string
    ): Promise<ImportSummary> =>
      ipcRenderer.invoke('cloud:import', provider, token, identityId)
  },
  alarm: {
    getConfig: (): Promise<AlarmConfig> => ipcRenderer.invoke('alarm:getConfig'),
    saveConfig: (config: AlarmConfig): Promise<void> =>
      ipcRenderer.invoke('alarm:saveConfig', config),
    test: (config: AlarmConfig): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('alarm:test', config)
  },
  ai: {
    getConfig: (): Promise<AiConfigPublic> => ipcRenderer.invoke('ai:getConfig'),
    saveConfig: (input: AiConfigInput): Promise<void> =>
      ipcRenderer.invoke('ai:saveConfig', input),
    ask: (requestId: string, prompt: string, context?: string): void =>
      ipcRenderer.send('ai:ask', requestId, prompt, context),
    cancel: (requestId: string): void => ipcRenderer.send('ai:cancel', requestId),
    onDelta: (cb: (requestId: string, text: string) => void): (() => void) => {
      const listener = (_e: unknown, requestId: string, text: string): void => cb(requestId, text)
      ipcRenderer.on('ai:delta', listener)
      return () => ipcRenderer.removeListener('ai:delta', listener)
    },
    onDone: (cb: (requestId: string) => void): (() => void) => {
      const listener = (_e: unknown, requestId: string): void => cb(requestId)
      ipcRenderer.on('ai:done', listener)
      return () => ipcRenderer.removeListener('ai:done', listener)
    },
    onError: (cb: (requestId: string, message: string) => void): (() => void) => {
      const listener = (_e: unknown, requestId: string, message: string): void =>
        cb(requestId, message)
      ipcRenderer.on('ai:error', listener)
      return () => ipcRenderer.removeListener('ai:error', listener)
    }
  },
  plugins: {
    list: (): Promise<PluginResult> => ipcRenderer.invoke('plugins:list'),
    install: (): Promise<PluginResult> => ipcRenderer.invoke('plugins:install'),
    remove: (id: string): Promise<PluginResult> => ipcRenderer.invoke('plugins:remove', id),
    openFolder: (): Promise<void> => ipcRenderer.invoke('plugins:openFolder')
  },
  team: {
    list: (): Promise<TeamVaultPublic[]> => ipcRenderer.invoke('team:list'),
    save: (input: TeamVaultInput): Promise<unknown> => ipcRenderer.invoke('team:save', input),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('team:delete', id),
    assign: (
      kind: 'host' | 'group' | 'snippet' | 'identity',
      itemId: string,
      teamId: string | null
    ): Promise<void> => ipcRenderer.invoke('team:assign', kind, itemId, teamId),
    push: (teamId: string, passphrase: string): Promise<TeamVaultResult> =>
      ipcRenderer.invoke('team:push', teamId, passphrase),
    pull: (teamId: string, passphrase: string): Promise<TeamVaultResult> =>
      ipcRenderer.invoke('team:pull', teamId, passphrase)
  }
}

export type ConnexaApi = typeof api

contextBridge.exposeInMainWorld('connexa', api)
